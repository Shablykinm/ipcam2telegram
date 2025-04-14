module.exports = {
    ftp: {
        url: 'ftp://0.0.0.0:2121',
        // pasv: {
        //         ip: '192.168.88.11',
        //         portMin: 21000,
        //         portMax: 21010,
        // },
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