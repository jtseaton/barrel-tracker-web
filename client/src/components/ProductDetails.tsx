import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Product, Recipe } from '../types/interfaces';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

interface Ingredient {
  itemName: string;
  quantity: number;
  unit: string;
}

interface PackageType {
  type: string;
  price: string;
  isKegDepositItem: boolean;
}

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [items, setItems] = useState<{ name: string; type: string; enabled: number }[]>([]);
  const [packageTypes, setPackageTypes] = useState<PackageType[]>([]);
  const [availablePackageTypes, setAvailablePackageTypes] = useState<{ name: string; volume: number; enabled: number }[]>([]);
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
    ingredients: [{ itemName: '', quantity: 0, unit: 'lbs' }],
    quantity: 0,
    unit: 'gallons',
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products/${id}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setProduct(data);
        setPackageTypes(data.packageTypes || []);
      } catch (err: any) {
        setError('Failed to fetch product: ' + err.message);
      }
    };

    const fetchRecipes = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/recipes?productId=${id}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setRecipes(data);
      } catch (err: any) {
        setError('Failed to fetch recipes: ' + err.message);
      }
    };

    const fetchItems = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/items`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setItems(data);
      } catch (err: any) {
        setError('Failed to fetch items: ' + err.message);
      }
    };

    const fetchPackageTypes = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/package-types`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setAvailablePackageTypes(data);
      } catch (err: any) {
        setError('Failed to fetch package types: ' + err.message);
      }
    };

    if (id) {
      fetchProduct();
      fetchRecipes();
      fetchItems();
      fetchPackageTypes();
    }
  }, [id]);

  const handleSave = async () => {
    if (!product?.name) {
      setError('Product name is required');
      return;
    }
    const validPackageTypes = packageTypes.filter(pt => pt.type && !isNaN(parseFloat(pt.price)) && parseFloat(pt.price) >= 0);
    if (packageTypes.length !== validPackageTypes.length) {
      setError('All package types must have a valid type and non-negative price');
      return;
    }
    try {
      const method = id ? 'PATCH' : 'POST';
      const url = id ? `${API_BASE_URL}/api/products/${id}` : `${API_BASE_URL}/api/products`;
      console.log('handleSave: Sending PATCH/POST request', { url, payload: { ...product, packageTypes: validPackageTypes } });
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...product, packageTypes: validPackageTypes }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to save product: ${text}`);
      }
      const savedProduct = await res.json();
      console.log('handleSave: Received response', savedProduct);

      for (const pt of validPackageTypes) {
        const itemName = `${product.name} ${pt.type}`;
        console.log('handleSave: Creating item', { itemName });
        await fetch(`${API_BASE_URL}/api/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ name: itemName, type: 'Finished Goods', enabled: 1 }),
        });
      }

      setSuccessMessage('Product and items saved successfully');
      setTimeout(() => {
        setSuccessMessage(null);
        navigate('/products');
      }, 2000);
      setError(null);
    } catch (err: any) {
      console.error('handleSave: Error', err);
      setError('Failed to save product: ' + err.message);
    }
  };

  const handleAddRecipe = async () => {
    if (
      !newRecipe.name ||
      !newRecipe.productId ||
      newRecipe.quantity <= 0 ||
      !newRecipe.unit ||
      newRecipe.ingredients.some((ing) => !ing.itemName || ing.quantity <= 0 || !ing.unit)
    ) {
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
      const addedRecipe = await res.json();
      setRecipes([...recipes, addedRecipe]);
      setShowAddRecipeModal(false);
      setNewRecipe({ name: '', productId: parseInt(id || '0', 10), ingredients: [{ itemName: '', quantity: 0, unit: 'lbs' }], quantity: 0, unit: 'gallons' });
      setError(null);
    } catch (err: any) {
      setError('Failed to add recipe: ' + err.message);
    }
  };

  const addIngredient = () => {
    setNewRecipe({
      ...newRecipe,
      ingredients: [...newRecipe.ingredients, { itemName: '', quantity: 0, unit: 'lbs' }],
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

  const addPackageType = () => {
    setPackageTypes([...packageTypes, { type: '', price: '', isKegDepositItem: false }]);
  };

  const removePackageType = (index: number) => {
    setPackageTypes(packageTypes.filter((_, i) => i !== index));
  };

  const updatePackageType = (index: number, field: keyof PackageType, value: string | boolean) => {
    const updatedPackageTypes = [...packageTypes];
    updatedPackageTypes[index] = { ...updatedPackageTypes[index], [field]: value };
    setPackageTypes(updatedPackageTypes);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#EEC930', marginBottom: '20px' }}>{id ? 'Product Details' : 'Create Product'}</h2>
      {error && <div className="error">{error}</div>}
      {successMessage && (
        <div
          style={{
            color: '#28A745',
            backgroundColor: '#e6ffe6',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '10px',
            textAlign: 'center',
          }}
        >
          {successMessage}
        </div>
      )}
      {product || !id ? (
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Name:</label>
              <input
                type="text"
                value={product?.name || ''}
                onChange={(e) => setProduct({ ...product!, name: e.target.value })}
                placeholder="Enter product name"
                style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Abbreviation:</label>
              <input
                type="text"
                value={product?.abbreviation || ''}
                onChange={(e) => setProduct({ ...product!, abbreviation: e.target.value })}
                placeholder="Enter abbreviation"
                style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Enabled:</label>
              <input
                type="checkbox"
                checked={product?.enabled === 1}
                onChange={(e) => setProduct({ ...product!, enabled: e.target.checked ? 1 : 0 })}
                style={{ marginLeft: '10px' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Priority:</label>
              <input
                type="number"
                value={product?.priority || 0}
                onChange={(e) => setProduct({ ...product!, priority: parseInt(e.target.value) || 0 })}
                placeholder="Enter priority"
                style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Class:</label>
              <input
                type="text"
                value={product?.class || ''}
                onChange={(e) => setProduct({ ...product!, class: e.target.value })}
                placeholder="Enter class"
                style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Type:</label>
              <input
                type="text"
                value={product?.type || ''}
                onChange={(e) => setProduct({ ...product!, type: e.target.value })}
                placeholder="Enter type"
                style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Style:</label>
              <input
                type="text"
                value={product?.style || ''}
                onChange={(e) => setProduct({ ...product!, style: e.target.value })}
                placeholder="Enter style"
                style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>ABV:</label>
              <input
                type="number"
                value={product?.abv || 0}
                onChange={(e) => setProduct({ ...product!, abv: parseFloat(e.target.value) || 0 })}
                placeholder="Enter ABV"
                step="0.1"
                style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>IBU:</label>
              <input
                type="number"
                value={product?.ibu || 0}
                onChange={(e) => setProduct({ ...product!, ibu: parseInt(e.target.value) || 0 })}
                placeholder="Enter IBU"
                style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
              />
            </div>
          </div>
          <h3 style={{ color: '#EEC930', marginTop: '20px', marginBottom: '10px' }}>Package Types</h3>
          {packageTypes.map((pt, index) => (
            <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
              <select
                value={pt.type}
                onChange={(e) => updatePackageType(index, 'type', e.target.value)}
                style={{ width: '200px', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
              >
                <option value="">Select Package Type</option>
                {availablePackageTypes
                  .filter((pkg) => pkg.enabled)
                  .map((pkg) => (
                    <option key={pkg.name} value={pkg.name}>
                      {`${pkg.name} (${(pkg.volume * 31).toFixed(2)} gal)`}
                    </option>
                  ))}
              </select>
              <input
                type="text"
                value={pt.price}
                onChange={(e) => updatePackageType(index, 'price', e.target.value)}
                placeholder="Price"
                style={{ width: '100px', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
              />
              <label style={{ color: '#555', fontSize: '16px' }}>
                <input
                  type="checkbox"
                  checked={pt.isKegDepositItem}
                  onChange={(e) => updatePackageType(index, 'isKegDepositItem', e.target.checked)}
                />
                Is Keg Deposit Item?
              </label>
              <button
                onClick={() => removePackageType(index)}
                style={{
                  backgroundColor: '#F86752',
                  color: '#fff',
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={addPackageType}
            style={{
              backgroundColor: '#2196F3',
              color: '#fff',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px',
            }}
          >
            Add Package Type
          </button>
          <h3 style={{ color: '#EEC930', marginTop: '20px', marginBottom: '10px' }}>Recipes</h3>
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
                            <li key={idx}>{ing.itemName}: {ing.quantity} {ing.unit}</li>
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
            onClick={handleSave}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              marginRight: '10px',
            }}
          >
            Save Product
          </button>
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
            }}
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
              marginLeft: '10px',
            }}
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
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Product (required):
                </label>
                <select
                  value={newRecipe.productId || ''}
                  onChange={(e) => setNewRecipe({ ...newRecipe, productId: parseInt(e.target.value, 10) })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                  }}
                  disabled
                >
                  <option value="">Select Product</option>
                  {product && (
                    <option value={product.id}>{product.name}</option>
                  )}
                </select>
              </div>
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
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Unit (required):
                </label>
                <select
                  value={newRecipe.unit}
                  onChange={(e) => setNewRecipe({ ...newRecipe, unit: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                  }}
                >
                  <option value="gallons">Gallons</option>
                  <option value="liters">Liters</option>
                  <option value="barrels">Barrels</option>
                </select>
              </div>
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
                      }}
                    >
                      <option value="">Select Item</option>
                      {items.filter((item) => item.enabled).map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.name}
                        </option>
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
                      }}
                    />
                    <select
                      value={ingredient.unit}
                      onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                      style={{
                        width: '100px',
                        padding: '10px',
                        border: '1px solid #CCCCCC',
                        borderRadius: '4px',
                        fontSize: '16px',
                      }}
                    >
                      <option value="lbs">lbs</option>
                      <option value="kg">kg</option>
                      <option value="oz">oz</option>
                      <option value="gal">gal</option>
                      <option value="l">l</option>
                    </select>
                    <button
                      onClick={() => removeIngredient(index)}
                      style={{
                        backgroundColor: '#F86752',
                        color: '#fff',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
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
                }}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowAddRecipeModal(false);
                  setNewRecipe({ name: '', productId: parseInt(id || '0', 10), ingredients: [{ itemName: '', quantity: 0, unit: 'lbs' }], quantity: 0, unit: 'gallons' });
                  setError(null);
                }}
                style={{
                  backgroundColor: '#F86752',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
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