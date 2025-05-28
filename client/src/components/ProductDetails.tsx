import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Product, Recipe, PackageType, Ingredient } from '../types/interfaces';
import RecipeModal from './RecipeModal';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [items, setItems] = useState<{ name: string; type: string; enabled: number }[]>([]);
  const [packageTypes, setPackageTypes] = useState<PackageType[]>([]);
  const [availablePackageTypes, setAvailablePackageTypes] = useState<{ name: string; volume: number; enabled: number }[]>([]);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products/${id}`, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log('[ProductDetails] Fetched product:', data);
        setProduct(data);
        setPackageTypes(data.packageTypes || []);
      } catch (err: any) {
        setError('Failed to fetch product: ' + err.message);
        console.error('[ProductDetails] Fetch product error:', err);
      }
    };

    const fetchRecipes = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/recipes?productId=${id}`, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log('[ProductDetails] Fetched recipes:', data);
        setRecipes(data);
      } catch (err: any) {
        setError('Failed to fetch recipes: ' + err.message);
        console.error('[ProductDetails] Fetch recipes error:', err);
      }
    };

    const fetchItems = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/items`, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log('[ProductDetails] Fetched items:', data);
        setItems(data);
      } catch (err: any) {
        setError('Failed to fetch items: ' + err.message);
        console.error('[ProductDetails] Fetch items error:', err);
      }
    };

    const fetchPackageTypes = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/package-types`, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log('[ProductDetails] Fetched package types:', data);
        setAvailablePackageTypes(data);
      } catch (err: any) {
        setError('Failed to fetch package types: ' + err.message);
        console.error('[ProductDetails] Fetch package types error:', err);
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
      console.log('[ProductDetails] Saved product:', savedProduct);

      for (const pt of validPackageTypes) {
        const itemName = `${product.name} ${pt.type}`;
        console.log('[ProductDetails] Creating item:', { itemName });
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
      setError('Failed to save product: ' + err.message);
      console.error('[ProductDetails] Save error:', err);
    }
  };

  const handleAddRecipe = async (recipe: { name: string; productId: number; ingredients: Ingredient[]; quantity: number; unit: string }) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(recipe),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Add recipe error: HTTP ${res.status}, ${text.slice(0, 50)}`);
      }
      const addedRecipe = await res.json();
      console.log('[ProductDetails] Added recipe:', addedRecipe);
      setRecipes([...recipes, addedRecipe]);
      setShowAddRecipeModal(false);
      setError(null);
    } catch (err: any) {
      setError('Failed to add recipe: ' + err.message);
      console.error('[ProductDetails] Add recipe error:', err);
    }
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

  console.log('[ProductDetails] Render:', {
    productId: id,
    packageTypesLength: packageTypes.length,
    showAddRecipeModal,
    error,
    successMessage,
  });

  return (
    <div className="page-container container">
      <h2 className="app-header mb-4">{id ? 'Product Details' : 'Create Product'}</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      {product || !id ? (
        <div className="batch-details">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label className="form-label">Name:</label>
              <input
                type="text"
                value={product?.name || ''}
                onChange={(e) => setProduct({ ...product!, name: e.target.value })}
                placeholder="Enter product name"
                className="form-control"
              />
            </div>
            <div>
              <label className="form-label">Abbreviation:</label>
              <input
                type="text"
                value={product?.abbreviation || ''}
                onChange={(e) => setProduct({ ...product!, abbreviation: e.target.value })}
                placeholder="Enter abbreviation"
                className="form-control"
              />
            </div>
            <div>
              <label className="form-label">Enabled:</label>
              <input
                type="checkbox"
                checked={product?.enabled === 1}
                onChange={(e) => setProduct({ ...product!, enabled: e.target.checked ? 1 : 0 })}
                style={{ marginLeft: '10px' }}
              />
            </div>
            <div>
              <label className="form-label">Priority:</label>
              <input
                type="number"
                value={product?.priority || 0}
                onChange={(e) => setProduct({ ...product!, priority: parseInt(e.target.value) || 0 })}
                placeholder="Enter priority"
                className="form-control"
              />
            </div>
            <div>
              <label className="form-label">Class:</label>
              <input
                type="text"
                value={product?.class || ''}
                onChange={(e) => setProduct({ ...product!, class: e.target.value })}
                placeholder="Enter class"
                className="form-control"
              />
            </div>
            <div>
              <label className="form-label">Type:</label>
              <input
                type="text"
                value={product?.type || ''}
                onChange={(e) => setProduct({ ...product!, type: e.target.value })}
                placeholder="Enter type"
                className="form-control"
              />
            </div>
            <div>
              <label className="form-label">Style:</label>
              <input
                type="text"
                value={product?.style || ''}
                onChange={(e) => setProduct({ ...product!, style: e.target.value })}
                placeholder="Enter style"
                className="form-control"
              />
            </div>
            <div>
              <label className="form-label">ABV:</label>
              <input
                type="number"
                value={product?.abv || 0}
                onChange={(e) => setProduct({ ...product!, abv: parseFloat(e.target.value) || 0 })}
                placeholder="Enter ABV"
                step="0.1"
                className="form-control"
              />
            </div>
            <div>
              <label className="form-label">IBU:</label>
              <input
                type="number"
                value={product?.ibu || 0}
                onChange={(e) => setProduct({ ...product!, ibu: parseInt(e.target.value) || 0 })}
                placeholder="Enter IBU"
                className="form-control"
              />
            </div>
          </div>
          <h3 className="app-header mb-3">Package Types</h3>
          {packageTypes.map((pt, index) => (
            <div key={index} className="package-type-row">
              <select
                value={pt.type}
                onChange={(e) => updatePackageType(index, 'type', e.target.value)}
                className="form-control"
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
                className="form-control"
              />
              <label>
                <input
                  type="checkbox"
                  checked={pt.isKegDepositItem}
                  onChange={(e) => updatePackageType(index, 'isKegDepositItem', e.target.checked)}
                />
                Is Keg Deposit Item?
              </label>
              <button
                onClick={() => removePackageType(index)}
                className="btn btn-danger"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={addPackageType}
            className="btn btn-primary mt-3"
          >
            Add Package Type
          </button>
          <h3 className="app-header mb-3 mt-4">Recipes</h3>
          {recipes.length > 0 ? (
            <div className="inventory-table-container">
              <table className="inventory-table table table-striped">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Quantity</th>
                    <th>Ingredients</th>
                  </tr>
                </thead>
                <tbody>
                  {recipes.map((recipe) => (
                    <tr key={recipe.id}>
                      <td>{recipe.name}</td>
                      <td>{recipe.quantity} {recipe.unit}</td>
                      <td>
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
            </div>
          ) : (
            <div className="alert alert-info text-center">No recipes available.</div>
          )}
          <div className="inventory-actions mt-4">
            <button onClick={handleSave} className="btn btn-primary">
              Save Product
            </button>
            <button onClick={() => setShowAddRecipeModal(true)} className="btn btn-primary">
              Add New Recipe
            </button>
            <Link to="/products" className="btn btn-danger">
              Back to Products
            </Link>
          </div>
        </div>
      ) : (
        <div className="alert alert-info text-center">Loading...</div>
      )}
      <RecipeModal
        show={showAddRecipeModal}
        onClose={() => {
          setShowAddRecipeModal(false);
          setError(null);
        }}
        onSave={handleAddRecipe}
        products={product ? [product] : []}
        items={items}
        defaultProductId={parseInt(id || '0', 10)}
      />
    </div>
  );
};

export default ProductDetails;