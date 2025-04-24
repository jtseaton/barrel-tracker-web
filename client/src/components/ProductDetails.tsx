import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Product, Recipe, Unit } from '../types/interfaces'; // Add Unit

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

interface Ingredient {
  itemName: string;
  quantity: number;
}

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [items, setItems] = useState<{ name: string; type: string; enabled: number }[]>([]);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [newRecipe, setNewRecipe] = useState<{
  name: string;
  productId: number;
  ingredients: Ingredient[];
  quantity: number;
  unit: string;
}>({
  name: '',
  productId: parseInt(id || '0', 10),
  ingredients: [{ itemName: '', quantity: 0 }],
  quantity: 0,
  unit: 'gallons', // Default to gallons
});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products/${id}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log('Fetched product:', data);
        setProduct(data);
      } catch (err: any) {
        console.error('Fetch product error:', err);
        setError('Failed to fetch product: ' + err.message);
      }
    };

    const fetchRecipes = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/recipes?productId=${id}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log('Fetched recipes:', data);
        setRecipes(data);
      } catch (err: any) {
        console.error('Fetch recipes error:', err);
        setError('Failed to fetch recipes: ' + err.message);
      }
    };

    const fetchItems = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/items`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log('Fetched items:', data);
        setItems(data);
      } catch (err: any) {
        console.error('Fetch items error:', err);
        setError('Failed to fetch items: ' + err.message);
      }
    };

    fetchProduct();
    fetchRecipes();
    fetchItems();
  }, [id]);

  const handleAddRecipe = async () => {
    if (!newRecipe.name || !newRecipe.productId || newRecipe.quantity <= 0 || !newRecipe.unit || newRecipe.ingredients.some(ing => !ing.itemName || ing.quantity <= 0)) {
      setError('Recipe name, product, quantity, unit, and valid ingredients are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(newRecipe),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Add recipe error: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Invalid response for recipe: Expected JSON, got ${contentType}, Response: ${text.slice(0, 50)}`);
      }
      const addedRecipe = await res.json();
      setRecipes([...recipes, addedRecipe]);
      setShowAddRecipeModal(false);
      setNewRecipe({ name: '', productId: parseInt(id || '0', 10), ingredients: [{ itemName: '', quantity: 0 }], quantity: 0, unit: 'gallons' });
      setError(null);
    } catch (err: any) {
      console.error('Add recipe error:', err);
      setError('Failed to add recipe: ' + err.message);
    }
  };

  const addIngredient = () => {
    setNewRecipe({
      ...newRecipe,
      ingredients: [...newRecipe.ingredients, { itemName: '', quantity: 0 }],
    });
  };

  const removeIngredient = (index: number) => {
    setNewRecipe({
      ...newRecipe,
      ingredients: newRecipe.ingredients.filter((_, i) => i !== index),
    });
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string | number) => {
    const updatedIngredients = [...newRecipe.ingredients];
    updatedIngredients[index] = { ...updatedIngredients[index], [field]: value };
    setNewRecipe({ ...newRecipe, ingredients: updatedIngredients });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>Product Details</h2>
      {error && <div className="error">{error}</div>}
      {product ? (
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Name:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px', color: '#000000' }}>
                {product.name}
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Abbreviation:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px', color: '#000000' }}>
                {product.abbreviation}
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Enabled:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: product.enabled ? '#e0f7e0' : '#ffe0e0', borderRadius: '4px', color: '#000000' }}>
                {product.enabled ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Priority:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px', color: '#000000' }}>
                {product.priority}
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Class:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px', color: '#000000' }}>
                {product.class}
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Type:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px', color: '#000000' }}>
                {product.type}
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Style:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px', color: '#000000' }}>
                {product.style}
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>ABV:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px', color: '#000000' }}>
                {product.abv}%
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>IBU:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px', color: '#000000' }}>
                {product.ibu}
              </span>
            </div>
          </div>
            <h3 style={{ color: '#333', marginTop: '20px', marginBottom: '10px' }}>Recipes</h3>
            {recipes.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Name</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Quantity</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Ingredients</th>
                  </tr>
                </thead>
                <tbody>
                  {recipes.map((recipe) => (
                    <tr key={recipe.id} style={{ backgroundColor: '#fff' }}>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{recipe.name}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{recipe.quantity} {recipe.unit}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {recipe.ingredients && recipe.ingredients.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: '20px' }}>
                            {recipe.ingredients.map((ing, idx) => (
                              <li key={idx}>{ing.itemName}: {ing.quantity}</li>
                            ))}
                          </ul>
                        ) : (
                          'No ingredients specified'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#777', marginBottom: '20px' }}>No recipes available.</p>
            )}
          <button
            onClick={() => setShowAddRecipeModal(true)}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              transition: 'background-color 0.3s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#45a049')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#4CAF50')}
          >
            Add New Recipe
          </button>
          <Link
            to="/products"
            style={{
              display: 'inline-block',
              marginTop: '10px',
              padding: '10px 20px',
              backgroundColor: '#2196F3',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              transition: 'background-color 0.3s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
          >
            Back to Products
          </Link>
        </div>
      ) : (
        <p style={{ color: '#777', textAlign: 'center' }}>Loading...</p>
      )}
      {showAddRecipeModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              width: '500px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px', textAlign: 'center' }}>
              Create New Recipe
            </h3>
            {error && <div className="error" style={{ marginBottom: '10px' }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
              {/* Recipe Name */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Recipe Name (required):
                </label>
                <input
                  type="text"
                  value={newRecipe.name}
                  onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                  placeholder="Enter recipe name"
                  style={{
                    width: '100%',
                    maxWidth: '450px',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </div>
              {/* Product */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Product (required):
                </label>
                <select
                  value={newRecipe.productId || ''}
                  onChange={(e) => setNewRecipe({ ...newRecipe, productId: parseInt(e.target.value, 10) })}
                  style={{
                    width: '100%',
                    maxWidth: '450px',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                  }}
                  disabled // Pre-selected to current product
                >
                  <option value="">Select Product</option>
                  {product && (
                    <option value={product.id}>{product.name}</option>
                  )}
                </select>
              </div>
              {/* Quantity */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Quantity (required):
                </label>
                <input
                  type="number"
                  value={newRecipe.quantity || ''}
                  onChange={(e) => setNewRecipe({ ...newRecipe, quantity: parseFloat(e.target.value) || 0 })}
                  placeholder="Enter quantity"
                  step="0.01"
                  min="0"
                  style={{
                    width: '100%',
                    maxWidth: '450px',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </div>
              {/* Unit */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Unit (required):
                </label>
                <select
                  value={newRecipe.unit}
                  onChange={(e) => setNewRecipe({ ...newRecipe, unit: e.target.value })}
                  style={{
                    width: '100%',
                    maxWidth: '450px',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="gallons">Gallons</option>
                  <option value="liters">Liters</option>
                  <option value="barrels">Barrels</option>
                </select>
              </div>
              {/* Ingredients */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Ingredients (required):
                </label>
                {newRecipe.ingredients.map((ingredient, index) => (
                  <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                    <select
                      value={ingredient.itemName}
                      onChange={(e) => updateIngredient(index, 'itemName', e.target.value)}
                      style={{
                        width: '200px',
                        padding: '10px',
                        border: '1px solid #CCCCCC',
                        borderRadius: '4px',
                        fontSize: '16px',
                        boxSizing: 'border-box',
                        color: '#000000',
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <option value="">Select Item</option>
                      {items.filter(item => item.enabled).map((item) => (
                        <option key={item.name} value={item.name}>{item.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={ingredient.quantity || ''}
                      onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
                      placeholder="Quantity"
                      step="0.01"
                      min="0"
                      style={{
                        width: '100px',
                        padding: '10px',
                        border: '1px solid #CCCCCC',
                        borderRadius: '4px',
                        fontSize: '16px',
                        boxSizing: 'border-box',
                        color: '#000000',
                        backgroundColor: '#FFFFFF',
                      }}
                    />
                    <button
                      onClick={() => removeIngredient(index)}
                      style={{
                        backgroundColor: '#F86752',
                        color: '#fff',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={addIngredient}
                  style={{
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginTop: '10px',
                  }}
                >
                  Add Ingredient
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button
                onClick={handleAddRecipe}
                style={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'background-color 0.3s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowAddRecipeModal(false);
                  setNewRecipe({ name: '', productId: parseInt(id || '0', 10), ingredients: [{ itemName: '', quantity: 0 }], quantity: 0, unit: 'gallons' });
                  setError(null);
                }}
                style={{
                  backgroundColor: '#F86752',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'background-color 0.3s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#D32F2F')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#F86752')}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetails;