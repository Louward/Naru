const express = require('express');
const router = express.Router();

const DBController = require('../controllers/DBController');

router.get('/list', DBController.handleChatroomList);
router.get('/:chatID', DBController.handleChatroomMessages);

module.exports = router;
