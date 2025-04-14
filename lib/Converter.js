const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream');
const MemoryStream = require('memory-stream');
const Writable = require('stream').Writable;

class Converter {
    async wcam265ToMp4(buffer, filename) {
        const fs = require('fs')
        let outStream = new MemoryStream();
        //var outStream = fs.createWriteStream('output.mp4');
        //let bufferStream = new stream.PassThrough();
        return new Promise((resolve, reject) => {
            //console.log(buffer);
            console.log(filename);
            ffmpeg({
                source: stream.Readable.from(buffer, { objectMode: false })
              })
              .addOption('-c:v', 'libx265')
              .addOption('-movflags', 'faststart')
              .addOption('-movflags', 'frag_keyframe+empty_moov')
              .addOption('-f', 'mp4')
              .output(outStream, { end: true })
              .on('error', function (err, stdout, stderr) {
                console.log('Ошибка:', err);
                console.log('Стандартный вывод:', stdout);
                console.log('Стандартный поток ошибок:', stderr);
              })
              .on('end', function () {
                console.log('Закончено!');
                resolve(outStream.toBuffer());
              })
              .run();
        });
    }
}

module.exports = Converter;