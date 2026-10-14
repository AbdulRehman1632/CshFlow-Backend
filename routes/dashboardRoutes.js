const express = require('express');
const router = express.Router();
const {
  getOverallAnalytics,
  exportCSV
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/overall', getOverallAnalytics);
router.get('/export-csv', exportCSV);

module.exports = router;
