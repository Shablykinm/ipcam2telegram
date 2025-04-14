module.exports = {
    ftp: {
        url: 'ftp://0.0.0.0:2121',
        pasv: {
            //Важно только для докер контейнера - укажите реальный ip хоста. 
            // Если запускаете локально - можно закомментировать всю ветку pasv.
                ip: process.env.DOCKER_HOST_IP || '192.168.xx.xxx',
                portMin: 21000,
                portMax: 21010,
        },
        credentials: {
            'ftp': 'telegram'
        }
    },
    telegram: {
        default : {
            token: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            chatIds: [
                {
                    //Первая камера
                    folder: 'ladcam',
                    chat_id: -23123123123123,   
                    message_thread_id: 318   
                },
                {
                    //Вторая камера
                    folder: 'ladcam2',
                    chat_id: -32132131232132,     
                    message_thread_id: 668   
                },
                {
                    //Главный топик
                    //Если что-то попало в другую папку
                    //должно попасть в главную ветку
                    folder: null,
                    chat_id: -43534523421312,     
                    message_thread_id: undefined  
                }
            ]
        }
        
    }
};