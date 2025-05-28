// client/src/components/RecipeModal.tsx
import React, { useState, useEffect } from 'react';
import { Product, Ingredient } from '../types/interfaces';

interface RecipeModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (recipe: { name: string; productId: number; ingredients: Ingredient[]; quantity: number; unit: string }) => void;
  products: Product[];
  items: { name: string; type: string; enabled: number }[];
  defaultProductId?: number;
}

const RecipeModal: React.FC<RecipeModalProps> = ({ show, onClose, onSave, products, items, defaultProductId }) => {
  const [recipe, setRecipe] = useState<{
    name: string;
    productId: number;
    ingredients: Ingredient[];
    quantity: number;
    unit: string;
  }>({
    name: '',
    productId: defaultProductId || 0,
    ingredients: [{ itemName: '', quantity: 0, unit: 'lbs' }],
    quantity: 0,
    unit: 'barrels',
  });
  const [error, setError] = useState<string | null>(null);

  const addIngredient = () => {
    setRecipe({
      ...recipe,
      ingredients: [...recipe.ingredients, { itemName: '', quantity: 0, unit: 'lbs' }],
    });
  };

  const removeIngredient = (index: number) => {
    setRecipe({
      ...recipe,
      ingredients: recipe.ingredients.filter((_, i) => i !== index),
    });
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string | number) => {
    const updatedIngredients = [...recipe.ingredients];
    updatedIngredients[index] = { ...updatedIngredients[index], [field]: value };
    setRecipe({ ...recipe, ingredients: updatedIngredients });
  };

  const handleSubmit = () => {
    if (
      !recipe.name ||
      !recipe.productId ||
      recipe.quantity <= 0 ||
      !recipe.unit ||
      recipe.ingredients.some(ing => !ing.itemName || ing.quantity <= 0 || !ing.unit)
    ) {
      setError('Recipe name, product, valid quantity, unit, and ingredients are required');
      return;
    }
    onSave(recipe);
    setError(null);
  };

  if (!show) return null;

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2100 }}>
      <div className="modal-dialog modal-content" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div className="modal-header">
          <h5 className="modal-title" style={{ color: '#555555' }}>Create New Recipe</h5>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="recipe-form">
            <label className="form-label" style={{ fontWeight: 'bold', color: '#555555' }}>
              Recipe Name (required):
              <input
                type="text"
                value={recipe.name}
                onChange={e => setRecipe({ ...recipe, name: e.target.value })}
                placeholder="Enter recipe name"
                className="form-control"
              />
            </label>
            <label className="form-label" style={{ fontWeight: 'bold', color: '#555555' }}>
              Product (required):
              <select
                value={recipe.productId || ''}
                onChange={e => setRecipe({ ...recipe, productId: parseInt(e.target.value, 10) })}
                className="form-control"
                disabled={!!defaultProductId}
              >
                <option value="">Select Product</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label" style={{ fontWeight: 'bold', color: '#555555' }}>
              Recipe Quantity (required):
              <input
                type="number"
                value={recipe.quantity || ''}
                onChange={e => setRecipe({ ...recipe, quantity: parseFloat(e.target.value) || 0 })}
                placeholder="Enter quantity (e.g., 10)"
                step="0.01"
                min="0"
                className="form-control"
              />
            </label>
            <label className="form-label" style={{ fontWeight: 'bold', color: '#555555' }}>
              Unit (required):
              <select
                value={recipe.unit}
                onChange={e => setRecipe({ ...recipe, unit: e.target.value })}
                className="form-control"
              >
                <option value="barrels">Barrels</option>
                <option value="gallons">Gallons</option>
                <option value="liters">Liters</option>
              </select>
            </label>
            <label className="form-label" style={{ fontWeight: 'bold', color: '#555555' }}>
              Ingredients (required):
              {recipe.ingredients.map((ingredient, index) => (
                <div key={index} className="d-flex gap-2 mb-2 align-items-center">
                  <select
                    value={ingredient.itemName}
                    onChange={e => updateIngredient(index, 'itemName', e.target.value)}
                    className="form-control"
                  >
                    <option value="">Select Item</option>
                    {items.filter(item => item.enabled).map(item => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={ingredient.quantity || ''}
                    onChange={e => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
                    placeholder="Quantity"
                    step="0.01"
                    min="0"
                    className="form-control"
                    style={{ width: '100px' }}
                  />
                  <select
                    value={ingredient.unit}
                    onChange={e => updateIngredient(index, 'unit', e.target.value)}
                    className="form-control"
                    style={{ width: '100px' }}
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                    <option value="oz">oz</option>
                    <option value="gal">gal</option>
                    <option value="l">l</option>
                  </select>
                  <button
                    onClick={() => removeIngredient(index)}
                    className="btn btn-danger"
                    style={{ padding: '8px 12px' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button onClick={addIngredient} className="btn btn-primary mt-2">
                Add Ingredient
              </button>
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={handleSubmit} className="btn btn-primary">
            Create
          </button>
          <button
            onClick={onClose}
            className="btn btn-danger"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeModal;