const cloudinary = require('cloudinary').v2;

// Create
const createProductCategory = async (req, res) => {
  try {
    const { name, level, parentId, entity, status } = req.body;

    // Validation: Level 2 & 3 must have a parent
    if (level > 1 && !parentId) {
      return res.status(400).json({ success: false, message: "Parent category is required for sub-levels." });
    }

    const newCategory = new req.db.ProductCategory({
      name,
      level,
      parentId: level === 1 ? null : parentId,
      entity,
      status: status || 1
    });

    await newCategory.save();
    res.status(201).json({ success: true, category: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Read (Populate parent to show names in table)
const getAllProductCategories = async (req, res) => {
  try {
    const { entity } = req.query;
    let filter = {};

    // Validate that entity exists and is NOT the string "undefined" or "null"
    if (entity && entity !== "undefined" && entity !== "null") {
      const entityNum = Number(entity);
      
      // Only apply filter if it's a valid number
      if (!isNaN(entityNum)) {
        filter.$or = [{ entity: entityNum }];
        
        // Handle global entity logic (Entity 1 sees nulls)
        if (entityNum === 1) {
          filter.$or.push({ entity: null });
        }
      }
    }

    const categories = await req.db.ProductCategory.find(filter)
      .populate('parentId', 'name')
      .sort({ level: 1, name: 1 });

    res.status(200).json({ success: true, categories });
  } catch (error) {
    // This catch block was catching the CastError and sending the 500
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update
const updateProductCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await req.db.ProductCategory.findByIdAndUpdate(id, req.body, { new: true });
    res.status(200).json({ success: true, category: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete with Protection
const deleteProductCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if it has children
    const hasChildren = await req.db.ProductCategory.exists({ parentId: id });
    if (hasChildren) {
      return res.status(400).json({ success: false, message: "Cannot delete parent category with existing sub-categories." });
    }

    await req.db.ProductCategory.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Image (Cloudinary Logic)
const deleteCategoryImage = async (req, res) => {
  try {
    const { catId, publicId } = req.params;
    const category = await req.db.ProductCategory.findById(catId);
    
    cloudinary.config(req.cloudinaryConfig);
    await cloudinary.uploader.destroy(publicId);

    category.imagePublicIds = (category.imagePublicIds || "")
      .split(',')
      .filter(id => id.trim() !== publicId)
      .join(',');

    await category.save();
    res.json({ success: true, message: "Image deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createProductCategory, getAllProductCategories, updateProductCategory, deleteProductCategory, deleteCategoryImage };