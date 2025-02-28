var cron = require('node-cron');

cron.schedule('* * * * *', () => {
    console.log('Test');
});