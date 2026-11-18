function categoryOf(product) {
  return String(product && product.category || '').trim().toLowerCase();
}

function tagOf(product) {
  return String(product && product.tag || '').trim().toLowerCase();
}

var CatalogueSections = {
  isSupplierTrainingCourse(product) {
    const tag = tagOf(product);
    return categoryOf(product) === 'supplier training courses (sos)' || tag === 'sos' || tag === '[sos]';
  },
  isRedCrossCourse(product) {
    return tagOf(product) === 'canadian red cross';
  },
  isAedPageProduct(product) {
    if (CatalogueSections.isSupplierTrainingCourse(product)) return false;
    return ['aed devices', 'aed pads & batteries', 'aed accessories', 'aed sales'].includes(categoryOf(product));
  },
  isTrainingProduct(product) {
    if (CatalogueSections.isSupplierTrainingCourse(product) || CatalogueSections.isRedCrossCourse(product)) return false;
    return categoryOf(product) === 'first aid training';
  },
  isEquipmentCategory(category) {
    const value = String(category || '').trim().toLowerCase();
    return /^prestan\b/i.test(value) || ['first aid kits', 'ppe', 'workplace first aid supplies'].includes(value);
  },
  isEquipmentProduct(product) {
    if (CatalogueSections.isSupplierTrainingCourse(product)) return false;
    return CatalogueSections.isEquipmentCategory(product && product.category);
  }
};

if (typeof module !== 'undefined') module.exports = CatalogueSections;
