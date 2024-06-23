const { MongoClient, ServerApiVersion } = require('mongodb');
const mongoose = require('mongoose');

const password = encodeURIComponent(process.env.DB_PASSWORD);
const dbname = "myDatabase";
const uri = `mongodb+srv://johndoe5223g:${password}@naru.sbwjpox.mongodb.net/${dbname}`;

mongoose.connect(uri, {
    serverApi: ServerApiVersion.v1
}).then(() => {
    console.log("Successfully connected to MongoDB Atlas!");
}).catch(err => {
    console.error("Connection error", err);
    process.exit();
});

// ���� �����ͺ��̽� �۾��� ������ �� �ֽ��ϴ�.
