const express = require('express');
const router = express.Router();
const {
  createProductCategory,
  getAllProductCategories,
  updateProductCategory,
  deleteProductCategory,
  deleteCategoryImage
} = require('../controllers/productCategoryController');

router.post('/', createProductCategory);
router.get('/', getAllProductCategories);
router.put('/:id', updateProductCategory);
router.delete('/:id', deleteProductCategory);
router.delete('/image/:catId/:publicId', deleteCategoryImage);

module.exports = router;