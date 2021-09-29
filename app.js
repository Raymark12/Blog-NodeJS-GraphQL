const path = require('path');

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { graphqlHTTP } = require('express-graphql');

const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');
const { clearImage } = require('./util/file');

const app = express();

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images');
    },
    filename: (req, file, cb) => {
        // const extension = file.mimetype.slice(6, file.mimetype.length); // extract the extension from the mimetype
        cb(null, uuidv4() + new Date().getTime() + '-' + file.originalname) // adding the extension
    }
});

const fileFilter = (req, file, cb) => {
    if (
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/jpeg'
    ) {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

// app.use(bodyParser.urlencoded()); // x-www-form-url-encoded <form>
app.use(express.json()); // application/json
app.use(
    multer({ storage: fileStorage, fileFilter: fileFilter }).single('image')
);
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(auth);

app.put('/post-image', (req, res, next) => {
    if (!req.isAuth) {
        throw new Error('Not authenticated.');
    }
    if (!req.file) {
        return res.status(200).json({ message: 'No file provided!' });
    }
    if (req.body.oldPath) {
        clearImage(req.body.oldPath);
    }
    return res
        .status(201)
        .json({ message: 'File stored.', filePath: req.file.path.replace('\\', '/') 
        });
}); 

app.use(
    '/graphql', 
    graphqlHTTP({
        schema: graphqlSchema,
        rootValue: graphqlResolver,
        graphiql: true,
        customFormatErrorFn(err) {
            if (!err.originalError)  {
                return err;
            }
            const data = err.originalError.data;
            const message = err.message || 'An error occured';
            const code = err.originalError.code || 500;
            return { message: message, status: code, data: data };
        }
    })
);

app.use((error, req, res, next) => {
    console.log(error);
    const status = error.statusCode || 500;
    const message = error.message;
    const data = error.data;
    res.status(status).json({ message: message, data: data });
});

mongoose
    .connect(
        `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0.2k6dg.mongodb.net/${process.env.MONGO_DEFAULT_DATABASE}?authSource=admin&replicaSet=atlas-8v231p-shard-0&readPreference=primary&appname=MongoDB%20Compass&ssl=true`
    )
    .then(result => {
        app.listen(process.env.PORT || 8080);
    })
    .catch(err => console.log(err));