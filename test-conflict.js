// Main branch version with validation
function calculateTotal(items) {
  if (!Array.isArray(items)) {
    throw new Error('Items must be an array');
  }
  return items.reduce((sum, item) => sum + (item.price || 0), 0);
}

class ShoppingCart {
  constructor() {
    this.items = [];
  }

  addItem(item) {
    this.items.push(item);
  }

  getTotal() {
    return calculateTotal(this.items);
  }
}

module.exports = { ShoppingCart, calculateTotal };
