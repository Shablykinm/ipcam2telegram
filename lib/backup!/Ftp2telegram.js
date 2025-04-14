const FtpSrv = require('ftp-srv');
const isInSubnet = require('is-in-subnet');
const os = require('os');

const TelegramProxy = require('./TelegramProxy');
const MemoryFileSystem = require('./MemoryFileSystem');
const logger = require('./Logger');

class Ftp2Telegram {

    constructor(config) {
        this.config = config;
        this.telegramProxy = new TelegramProxy(config.telegram);

        const ftpConfig = {
            url: config.ftp.url,
            anonymous: this.isAnonymous(),
            pasv_url: this.resolvePassiveModeIp,
        };

        if (config.ftp.pasv) {
            if (config.ftp.pasv.ip) {
                ftpConfig.pasv_url = config.ftp.pasv.ip;
            }
            if (config.ftp.pasv.portMin) {
                ftpConfig.pasv_min = config.ftp.pasv.portMin;
            }
            if (config.ftp.pasv.portMax) {
                ftpConfig.pasv_max = config.ftp.pasv.portMax;
            }
        }

        this.ftp = new FtpSrv(ftpConfig);
        this.ftp.on('login', this.onLogin.bind(this));
    }


    listen() {
        return this.ftp.listen().then(_ => logger.info('Server is running'));
    }

    isAnonymous() {
        return (!this.config.ftp.credentials || Object.keys(this.config.ftp.credentials).length === 0);
    }

    isLoginValid(username, password) {
        return this.config.ftp.credentials[username] && this.config.ftp.credentials[username] === password;
    }

    findChatConfig(foldername) {
        const isRoot = foldername === '/';
        const cleanPath = isRoot ? '' : foldername.replace(/^\/+|\/+$/g, '');
        const topFolder = isRoot ? null : cleanPath.split('/')[0];

        return this.config.telegram.default.chatIds.find(c => c.folder === topFolder)
            || this.config.telegram.default.chatIds.find(c => c.folder === null);
    }

    onLogin({ connection, username, password }, resolve, reject) {
        //logger.info({ip: connection.ip}, 'New connection');

        if (!this.isAnonymous() && !this.isLoginValid(username, password)) {
            return reject();
        }

        // 1. Гарантированное создание корневой папки
        const memoryFileSystem = new MemoryFileSystem();
        memoryFileSystem.mkdir('/');

        // 2. Корректное создание папок из конфига
        this.config.telegram.default.chatIds
            .filter(c => c.folder)
            .forEach(c => {
                const absolutePath = `/${c.folder}`;
                try {
                    // Создаем только если папка не существует
                    if (!memoryFileSystem.dirs.has(absolutePath)) {
                        memoryFileSystem.mkdir(absolutePath);
                        logger.debug(`Created config folder: ${absolutePath}`);
                    }
                } catch (e) {
                    logger.error(`Config folder error: ${e.message}`);
                }
            });

        // 3. Фикс обработки команды CWD
        connection.on('CWD', (error, path) => {
            try {
                const resolvedPath = path.startsWith('/')
                    ? path
                    : nodePath.posix.join(memoryFileSystem.currentDirectory(), path);

                memoryFileSystem.chdir(resolvedPath);
                logger.debug(`CWD success: ${resolvedPath}`);
            } catch (e) {
                logger.error(`CWD failed: ${e.message}`);
                connection.reply(550, e.message);
            }
        });
        connection.on('CDUP', (error) => {
            try {
                const prevDir = memoryFileSystem.currentDirectory();
                memoryFileSystem.chdir('..');
                logger.debug(`CDUP: ${prevDir} → ${memoryFileSystem.currentDirectory()}`);
            } catch (e) {
                logger.error(`CDUP failed: ${e.message}`);
                connection.reply(550, `Error: ${e.message}`);
            }
        });

        connection.on('LIST', (error, path) => {
            if (error) logger.error(`LIST error: ${error}`);
        });

        connection.on('STOR', async (error, filename) => {
            const stream = memoryFileSystem.getUploaded(filename);
            const foldername = memoryFileSystem.currentDirectory();
            if (!stream) return;

            try {
                const chatConfig = this.findChatConfig(foldername);
                if (!chatConfig) {
                    logger.error(`No chat config found for folder: ${foldername}`);
                    return;
                }

                await this.telegramProxy.send(
                    filename,
                    stream,
                    chatConfig.chat_id,
                    chatConfig.message_thread_id
                );
                logger.info(`File successfully sent: ${filename}`);
            } catch (e) {
                logger.error(`Final send failed: ${e.message}`);
            } finally {
                memoryFileSystem.removeUploaded(filename);
            }
        });

        return resolve({
            fs: memoryFileSystem
        });
    }

    resolvePassiveModeIp(address) {
        const nets = os.networkInterfaces();

        const result = Object
            .keys(nets)
            .map(key => nets[key])
            .reduce((carry, value) => carry.concat(value), [])
            .filter(net => isInSubnet.check(address, net.cidr));

        let ip = '127.0.0.1';
        if (result.length > 0) {
            ip = result[0].address;
        }

        //logger.info({clientIp: address, serverIp: ip}, 'resolved PASV ip');
        return ip;
    }
}


module.exports = Ftp2Telegram;
