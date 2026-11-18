var CatalogueSections = {
  isAedPageProduct(product) {
    return ['aed devices', 'aed pads & batteries', 'aed accessories', 'aed sales'].includes(String(product && product.category || '').trim().toLowerCase());
  },
  isTrainingProduct(product) {
    return ['first aid training', 'supplier training courses (sos)', 'online courses'].includes(String(product && product.category || '').trim().toLowerCase());
  },
  isEquipmentCategory(category) {
    const value = String(category || '').trim().toLowerCase();
    return /^prestan\b/i.test(value) || ['first aid kits', 'ppe', 'workplace first aid supplies'].includes(value);
  },
  isEquipmentProduct(product) {
    return CatalogueSections.isEquipmentCategory(product && product.category);
  }
};

if (typeof module !== 'undefined') module.exports = CatalogueSections;
