const express = require("express");
const {
  createDonor,
  getDonors,
  updateDonor,
  deleteDonor,
  getDonorTracking,
  payDonorContribution
} = require("../controllers/donorController");

const router = express.Router();

router.post("/", createDonor);
router.get("/", getDonors);
router.put("/:id", updateDonor);
router.delete("/:id", deleteDonor);
router.get("/tracking", getDonorTracking);
router.post("/pay", payDonorContribution);

module.exports = router;
