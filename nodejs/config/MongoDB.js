const { ServerApiVersion } = require('mongodb');
const mongoose = require('mongoose');

// MONGODB_URI가 있으면 그대로 사용하고, 없으면 기존 Atlas 설정(DB_USER/DB_PASSWORD)으로 조합
function buildUri() {
    if (process.env.MONGODB_URI) return process.env.MONGODB_URI;

    const user = encodeURIComponent(process.env.DB_USER || 'johndoe5223g');
    const password = encodeURIComponent(process.env.DB_PASSWORD);
    const host = process.env.DB_HOST || 'naru.sbwjpox.mongodb.net';
    const dbname = process.env.DB_NAME || 'myDatabase';
    return `mongodb+srv://${user}:${password}@${host}/${dbname}`;
}

mongoose.connect(buildUri(), {
    serverApi: ServerApiVersion.v1
}).then(() => {
    console.log("Successfully connected to MongoDB!");
}).catch(err => {
    console.error("Connection error", err);
    process.exit(1);
});
