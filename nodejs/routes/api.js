const express = require('express');
const router = express.Router();

const AIController = require('../controllers/AIController');
const DBController = require('../controllers/DBController');

router.post('/enter', AIController.handleEnter);
router.get('/list', DBController.handleChatroomList);
router.get('/:chatID', DBController.handleChatroomMessages);

module.exports = router;
