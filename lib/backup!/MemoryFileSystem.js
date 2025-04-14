const MemoryStream = require('memory-stream');
const { PassThrough } = require('stream');
const nodePath = require('path');
const logger = require('./Logger');

const UNIX_SEP_REGEX = /\//g;
const WIN_SEP_REGEX = /\\/g;

class MemoryFileSystem {
    constructor() {
        this.storage = {};  // Храним Buffer вместо MemoryStream
        this.dirs = new Set(['/']);
        this.cwd = '/';
    }

    _normalizePath(path) {
        return nodePath.posix.resolve('/', path);
    }
    _resolvePath(path = '.') {
        // Unix separators normalize nicer on both unix and win platforms
        const resolvedPath = path.replace(WIN_SEP_REGEX, '/');

        // Join cwd with new path
        const joinedPath = nodePath.isAbsolute(resolvedPath)
            ? nodePath.normalize(resolvedPath)
            : nodePath.join('/', this.cwd, resolvedPath);

        // Create local filesystem path using the platform separator
        const fsPath = nodePath.resolve(nodePath.join(this.root, joinedPath)
            .replace(UNIX_SEP_REGEX, nodePath.sep)
            .replace(WIN_SEP_REGEX, nodePath.sep));

        // Create FTP client path using unix separator
        const clientPath = joinedPath.replace(WIN_SEP_REGEX, '/');

        return {
            clientPath,
            fsPath
        };
    }

    currentDirectory() {
        return this.cwd;
    }

    chdir(path) {
        const normalizedPath = path
            .replace(/\\/g, '/') // Нормализация Windows-путей
            .replace(/\/+/g, '/'); // Убираем дублирующие слеши
    
        let targetPath;
        
        // Обработка относительных путей
        if (normalizedPath.startsWith('/')) {
            targetPath = this._normalizePath(normalizedPath);
        } else {
            targetPath = this._normalizePath(nodePath.posix.join(this.cwd, normalizedPath));
        }
    
        // Защита от выхода за пределы корня
        if (targetPath === '') targetPath = '/';
        
        logger.debug(`Attempting to change directory to: ${targetPath}`);
    
        if (!this.dirs.has(targetPath)) {
            const errorMsg = `Directory ${targetPath} does not exist`;
            logger.warn(errorMsg);
            throw new Error(errorMsg);
        }
    
        this.cwd = targetPath;
        logger.info(`Directory changed to: ${this.cwd}`);
        return targetPath;
    }

    mkdir(dir) {
        // Принудительная обработка абсолютных путей
        const resolvedDir = dir.startsWith('/') 
            ? this._normalizePath(dir)
            : this._normalizePath(nodePath.posix.join(this.cwd, dir));
    
        if (resolvedDir === '/') return '/';
    
        let currentPath = '/';
        for (const part of resolvedDir.split('/').filter(p => p)) {
            currentPath = nodePath.posix.join(currentPath, part);
            if (!this.dirs.has(currentPath)) {
                this.dirs.add(currentPath);
                logger.debug(`Directory created: ${currentPath}`);
            }
        }
        
        return resolvedDir;
    }


    delete(filename) {
        return Promise.resolve();
    }

    list() {
        const currentDir = this._normalizePath(this.cwd);

        const subDirs = Array.from(this.dirs).filter(d => {
            const parent = nodePath.posix.dirname(d);
            return parent === currentDir && d !== parent;
        }).map(d => ({
            name: nodePath.posix.basename(d),
            isDirectory: () => true, // Исправлено на функцию
            size: 0,
            mtime: new Date(),
            mode: 16877, // Добавлены права доступа для директории
            uid: 0,
            gid: 0
        }));

        const files = Object.keys(this.storage)
            .filter(f => {
                const dir = nodePath.posix.dirname(f);
                return dir === currentDir;
            })
            .map(f => ({
                name: nodePath.posix.basename(f),
                isDirectory: () => false, // Исправлено на функцию
                size: this.storage[f].size(),
                mtime: new Date(),
                mode: 33188, // Права доступа для файла
                uid: 0,
                gid: 0
            }));

        return [...subDirs, ...files];
    }

    get(filename) {

        if (filename !== '.') {
            return Promise.reject('File "' + filename + '" not found.');
        }

        const fakeTime = Date.now();

        // Fake STAT to fake an empty directory
        return {
            dev: 3538821179,
            mode: 16822,
            nlink: 1,
            uid: 0,
            gid: 0,
            rdev: 0,
            blksize: 4096,
            ino: 7599824371330281,
            size: 1,
            blocks: 1,
            atimeMs: +fakeTime,
            mtimeMs: +fakeTime,
            ctimeMs: +fakeTime,
            birthtimeMs: +fakeTime,
            atime: fakeTime,
            mtime: fakeTime,
            ctime: fakeTime,
            birthtime: fakeTime,
            isDirectory: _ => true
        };
    }

    write(filename, options) {
        const dirPath = nodePath.posix.dirname(filename);
        this._createDirsRecursive(dirPath);

        if (options?.append) {
            throw new Error('Unsupported');
        }

        const stream = new PassThrough();
        const chunks = [];

        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => {
            this.storage[filename] = Buffer.concat(chunks);
            logger.debug(`File stored: ${filename} (${this.storage[filename].length} bytes)`);
        });

        return { stream, clientPath: filename };
    }

    _createDirsRecursive(path) {
        let currentPath = '/';
        for (const part of path.split('/').filter(p => p)) {
            currentPath = nodePath.posix.join(currentPath, part);
            if (!this.dirs.has(currentPath)) {
                this.dirs.add(currentPath);
                logger.debug(`Created directory: ${currentPath}`);
            }
        }
    }

    removeUploaded(filename) {
        delete this.storage[filename];
    }

    getUploaded(filename) {
        return this.storage[filename] || null;
    }
}

module.exports = MemoryFileSystem;
