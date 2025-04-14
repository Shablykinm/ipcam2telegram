const { Telegraf } = require('telegraf');
const MagicBytes = require('magic-bytes.js');
const logger = require('./Logger');
const Converter = require('./Converter');
const { Agent } = require('https');

class TelegramProxy {
    constructor(config) {
        this.Converter = new Converter();
        this.config = this.validateConfig(config);
        this.bot = this.initBot();
        this.types = {
            // Video types
            '265': 'video/mp4',
            'h265': 'video/mp4',
            '264': 'video/mp4',
            'h264': 'video/mp4',
            'mp4': 'video/mp4',
            // Image types
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            // Documents
            'pdf': 'application/pdf'
        };
    }

    initBot() {
        const agent = new Agent({ keepAlive: true });
        const bot = new Telegraf(this.config.default.token, {
            telegram: {
                agent,
                apiRoot: 'https://api.telegram.org'
            }
        });

        // Обработка ошибок
        bot.catch((err, ctx) => {
            logger.error('Telegram API error:', {
                error: err.message,
                update: ctx.update
            });
            return ctx.reply('❌ Ошибка обработки запроса');
        });

        return bot;
    }

    validateConfig(config) {
        return {
            ...config,
            default: {
                ...config.default,
                chatIds: config.default.chatIds.map(chat => ({
                    chat_id: Number(chat.chat_id),
                    message_thread_id: chat.message_thread_id || undefined
                }))
            }
        };
    }

    async send(fname, buffer, chat_id, message_thread_id) {
        const ext = fname.split('.').pop().toLowerCase();
    
        try {
            const file = {
                filename: fname,
                source: buffer,
                contentType: this.getContentType(buffer, ext)
            };
    
            await this.validateChat(chat_id);
    
            if (this.types[ext] && this.types[ext].startsWith('video/')) {
                await this.handleH265(chat_id, buffer, fname, message_thread_id);
                return;
            }
    
            await this.sendByType(chat_id, file, message_thread_id);
        } catch (err) {
            logger.error(`Critical error with ${fname}:`, err);
            throw err;
        }
    }
    
    getFallbackType(ext) {
        return this.types[ext] || 'application/octet-stream';
    }

    async sendByType(chat_id, file, message_thread_id) {
        const options = {
            message_thread_id,
            caption: file.filename,
            disable_notification: true,
            parse_mode: 'HTML'
        };

        try {
            // Добавляем логирование для отладки
            logger.debug(`Attempting to send file: ${file.filename}`, {
                size: file.source.length,
                mimeType: file.contentType,
                isImage: file.contentType.startsWith('image/')
            });

            // Попытка отправки как изображение
            if (file.contentType.startsWith('image/') && file.contentType !== 'image/gif') {
                // Проверка размера файла (Telegram limit: 10MB для фото)
                const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
                
                if (file.source.length > MAX_PHOTO_SIZE && file.contentType.startsWith('image/')) {
                    logger.warn(`Image too large (${file.source.length} bytes), sending as document`);
                    return this.sendAsDocument(chat_id, file, message_thread_id);
                }
                try {
                    await this.bot.telegram.sendPhoto(
                        chat_id, 
                        { source: file.source, filename: file.filename }, // Исправлено здесь
                        options
                    );
                    logger.info(`Photo sent successfully: ${file.filename}`);
                    return;
                } catch (photoError) {
                    logger.warn(`Failed to send as photo: ${photoError.message}`);
                }
            }

            // Отправка как документ для остальных случаев
            await this.bot.telegram.sendDocument(
                chat_id,
                { source: file.source, filename: file.filename },
                options
            );
            logger.info(`File sent as document: ${file.filename}`);

        } catch (err) {
            logger.error(`Final sending failed: ${err.message}`);
            throw err;
        }
    }

    getContentType(buffer, ext) {
        try {
            const mimeTypes = MagicBytes.filetypemime(buffer);
            // Берем первый распознанный тип или используем fallback
            return mimeTypes[0] || this.getFallbackType(ext);
        } catch (error) {
            logger.warn(`MIME-type detection failed: ${error.message}`);
            return this.getFallbackType(ext);
        }
    }

    async handleH265(chat_id, buffer, fname, message_thread_id) {
        try {
            const mp4Buffer = await this.Converter.wcam265ToMp4(buffer, fname);
            await this.bot.telegram.sendVideo(chat_id,
                { source: mp4Buffer, filename: `${fname}.mp4` },
                {
                    message_thread_id,
                    caption: fname,
                    disable_notification: true
                }
            );
        } catch (err) {
            logger.error(`H265 conversion failed for ${fname}:`, err);
            throw err;
        }
    }

    async validateChat(chat_id) {
        try {
            const chat = await this.bot.telegram.getChat(chat_id);
            if (!chat) throw new Error('Chat not found');
            logger.debug(`Chat validated: ${chat.id} (${chat.type})`);
        } catch (err) {
            throw new Error(`Chat validation failed for ${chat_id}: ${err.message}`);
        }
    }


    getFallbackType(ext) {
        const types = {
            '265': 'video/mp4',
            'h265': 'video/mp4',
            '264': 'video/mp4',
            'h264': 'video/mp4',
            'mp4': 'video/mp4',
            'jpg': 'image/jpeg',
            'pdf': 'application/pdf'
        };
        return types[ext] || 'application/octet-stream';
    }
}

module.exports = TelegramProxy;