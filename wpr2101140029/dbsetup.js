const mysql = require('mysql2');
const connection = mysql.createConnection({
user: 'wpr',
password: 'fit2023',
database: 'wpr2023'
}).promise();
const fs = require('fs').promises;
(async function () {
let content = await fs.readFile('./data.sql', { encoding: 'utf8' });
let lines = content.split('\r\n'); // Windows line separator
let tmp = '';
for (let line of lines) {
line = line.trim();
tmp += line + '\r\n';
if (line.endsWith(';')) { // statement detected
await connection.execute(tmp);
tmp = '';
}
}
await connection.end();
})();