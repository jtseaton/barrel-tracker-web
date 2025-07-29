import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Product, Recipe, PackageType, Ingredient } from '../types/interfaces';
import { ProductClass, ProductType, Style } from '../types/enums';
import RecipeModal from './RecipeModal';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:10000';

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

  const styleOptions: { [key in ProductType]?: Style[] } = {
    [ProductType.MaltBeverage]: [
      Style.Ale,
      Style.Lager,
      Style.IPA,
      Style.Stout,
      Style.Porter,
      Style.Pilsner,
      Style.Wheat,
      Style.Other,
    ],
    [ProductType.Seltzer]: [Style.Other],
    [ProductType.GrapeWine]: [Style.Red, Style.White, Style.Rosé, Style.Champagne, Style.Sherry, Style.Port, Style.Madeira],
    [ProductType.SparklingWine]: [Style.Champagne, Style.Other],
    [ProductType.CarbonatedWine]: [Style.Other],
    [ProductType.FruitWine]: [Style.Other],
    [ProductType.Cider]: [Style.Other],
    [ProductType.OtherAgriculturalWine]: [Style.Other],
    [ProductType.Whisky]: [Style.Bourbon, Style.Scotch, Style.Rye, Style.Other],
    [ProductType.Gin]: [Style.LondonDry, Style.Genever, Style.OldTom, Style.Other],
    [ProductType.Vodka]: [Style.Other],
    [ProductType.NeutralSpirits]: [Style.Other],
    [ProductType.Rum]: [Style.SpicedRum, Style.WhiteRum, Style.Other],
    [ProductType.Tequila]: [Style.Blanco, Style.Reposado, Style.Añejo, Style.Other],
    [ProductType.CordialsLiqueurs]: [Style.Other],
    [ProductType.FlavoredSpirits]: [Style.Cocktail, Style.Other],
    [ProductType.DistilledSpiritsSpecialty]: [Style.Cocktail, Style.Other],
  };

  const spiritsTypes = [
    ProductType.Whisky,
    ProductType.Gin,
    ProductType.Vodka,
    ProductType.NeutralSpirits,
    ProductType.Rum,
    ProductType.Tequila,
    ProductType.CordialsLiqueurs,
    ProductType.FlavoredSpirits,
    ProductType.DistilledSpiritsSpecialty,
  ];

  const wineTypes = [
    ProductType.GrapeWine,
    ProductType.SparklingWine,
    ProductType.CarbonatedWine,
    ProductType.FruitWine,
    ProductType.Cider,
    ProductType.OtherAgriculturalWine,
  ];

  const beerTypes = [ProductType.MaltBeverage, ProductType.Seltzer];

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('[ProductDetails] No token found, redirecting to login');
      navigate('/login');
      return null;
    }
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [navigate]);

  const mapServerToFrontend = (serverProduct: any): Product => {
    let mapped: Product = { ...serverProduct };
    let serverClass = serverProduct.class;
    let serverType = serverProduct.type;
    let serverStyle = serverProduct.style as Style | undefined;

    if (serverClass === 'Distilled') {
      mapped.class = ProductClass.Spirits;
    }

    let frontendType: ProductType | undefined;
    let frontendStyle: Style | undefined = serverStyle;

    if (mapped.class === ProductClass.Beer) {
      if (serverType === 'Malt') {
        frontendType = ProductType.MaltBeverage;
      } else if (serverType === 'Seltzer') {
        frontendType = ProductType.Seltzer;
      } else {
        frontendType = ProductType.MaltBeverage; // default
      }
    } else if (mapped.class === ProductClass.Wine) {
      if (serverType === 'Cider') {
        frontendType = ProductType.Cider;
      } else {
        frontendType = ProductType.GrapeWine; // default
        if (serverStyle) {
          if (serverStyle === 'Other') {
            frontendType = ProductType.GrapeWine;
          } else {
            for (const t of wineTypes) {
              if (styleOptions[t]?.includes(serverStyle)) {
                frontendType = t;
                break;
              }
            }
          }
        }
      }
    } else if (mapped.class === ProductClass.Spirits) {
      frontendType = ProductType.NeutralSpirits; // default
      if (serverStyle) {
        if (serverStyle === 'Other') {
          frontendType = ProductType.NeutralSpirits;
        } else {
          for (const t of spiritsTypes) {
            if (styleOptions[t]?.includes(serverStyle)) {
              frontendType = t;
              break;
            }
          }
        }
      }
    } else {
      frontendType = serverType as ProductType;
    }

    mapped.type = frontendType;
    mapped.style = frontendStyle;

    return mapped;
  };

  const mapToServerClass = (classValue: string | undefined): string => {
    if (classValue === ProductClass.Spirits) {
      return 'Distilled';
    }
    return classValue || '';
  };

  const mapToServerType = (classValue: string | undefined, typeValue: string | undefined): string => {
    if (classValue === ProductClass.Beer) {
      if (typeValue === ProductType.MaltBeverage) return 'Malt';
      if (typeValue === ProductType.Seltzer) return 'Seltzer';
    } else if (classValue === ProductClass.Wine) {
      if (typeValue === ProductType.Cider) return 'Cider';
      return 'Wine';
    } else if (classValue === ProductClass.Spirits) {
      return 'Spirits';
    }
    return typeValue || '';
  };

  const fetchProduct = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${id}`, { headers });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          console.error('[ProductDetails] Unauthorized, redirecting to login');
          navigate('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`HTTP error! status: ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      console.log('[ProductDetails] Fetched product:', data);
      const mappedProduct = mapServerToFrontend(data);
      setProduct(mappedProduct);
      setPackageTypes(data.packageTypes || []);
    } catch (err: any) {
      console.error('[ProductDetails] Fetch product error:', err);
      setError('Failed to fetch product: ' + err.message);
    }
  }, [id, getAuthHeaders, navigate]);

  const fetchRecipes = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/recipes?productId=${id}`, { headers });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          console.error('[ProductDetails] Unauthorized, redirecting to login');
          navigate('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`HTTP error! status: ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      console.log('[ProductDetails] Fetched recipes:', data);
      setRecipes(data);
    } catch (err: any) {
      console.error('[ProductDetails] Fetch recipes error:', err);
      setError('Failed to fetch recipes: ' + err.message);
    }
  }, [id, getAuthHeaders, navigate]);

  const fetchItems = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/items`, { headers });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          console.error('[ProductDetails] Unauthorized, redirecting to login');
          navigate('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`HTTP error! status: ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      console.log('[ProductDetails] Fetched items:', data);
      setItems(data);
    } catch (err: any) {
      console.error('[ProductDetails] Fetch items error:', err);
      setError('Failed to fetch items: ' + err.message);
    }
  }, [getAuthHeaders, navigate]);

  const fetchPackageTypes = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/package-types`, { headers });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          console.error('[ProductDetails] Unauthorized, redirecting to login');
          navigate('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`HTTP error! status: ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      console.log('[ProductDetails] Fetched package types:', data);
      setAvailablePackageTypes(data);
    } catch (err: any) {
      console.error('[ProductDetails] Fetch package types error:', err);
      setError('Failed to fetch package types: ' + err.message);
    }
  }, [getAuthHeaders, navigate]);

  useEffect(() => {
    if (id) {
      fetchProduct();
      fetchRecipes();
      fetchItems();
      fetchPackageTypes();
    } else {
      setProduct({
        id: 0,
        name: '',
        abbreviation: '',
        enabled: 1,
        priority: 1,
        class: ProductClass.Beer,
        type: ProductType.MaltBeverage,
        style: Style.Other,
        abv: 0,
        ibu: 0,
      });
      setPackageTypes([]);
    }
  }, [id, fetchProduct, fetchRecipes, fetchItems, fetchPackageTypes]);

  const handleSave = useCallback(async () => {
    if (!product?.name || !product.class || !product.type) {
      setError('Name, Class, and Type are required');
      return;
    }
    if (product.class !== ProductClass.Spirits && !product.style) {
      setError('Style is required for Beer and Wine');
      return;
    }
    const validPackageTypes = packageTypes.filter(pt => pt.type && !isNaN(parseFloat(pt.price)) && parseFloat(pt.price) >= 0);
    if (packageTypes.length !== validPackageTypes.length) {
      setError('All package types must have a valid type and non-negative price');
      return;
    }
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const serverClass = mapToServerClass(product.class);
      const serverType = mapToServerType(product.class, product.type);
      const serverProduct = { ...product, class: serverClass, type: serverType };
      const method = id ? 'PATCH' : 'POST';
      const url = id ? `${API_BASE_URL}/api/products/${id}` : `${API_BASE_URL}/api/products`;
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ ...serverProduct, packageTypes: validPackageTypes }),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          console.error('[ProductDetails] Unauthorized, redirecting to login');
          navigate('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`Failed to save product: HTTP ${res.status}, ${text.slice(0, 50)}`);
      }
      const savedProduct = await res.json();
      console.log('[ProductDetails] Saved product:', savedProduct);

      for (const pt of validPackageTypes) {
        const itemName = `${product.name} ${pt.type}`;
        console.log('[ProductDetails] Creating item:', { itemName });
        const itemRes = await fetch(`${API_BASE_URL}/api/items`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: itemName, type: 'Finished Goods', enabled: 1 }),
        });
        if (!itemRes.ok) {
          const text = await itemRes.text();
          if (itemRes.status === 401) {
            console.error('[ProductDetails] Unauthorized, redirecting to login');
            navigate('/login');
            throw new Error('Unauthorized');
          }
          throw new Error(`Failed to create item ${itemName}: HTTP ${itemRes.status}, ${text.slice(0, 50)}`);
        }
      }

      setSuccessMessage('Product and items saved successfully');
      setTimeout(() => {
        setSuccessMessage(null);
        navigate('/products');
      }, 2000);
      setError(null);
    } catch (err: any) {
      console.error('[ProductDetails] Save error:', err);
      setError('Failed to save product: ' + err.message);
    }
  }, [product, packageTypes, id, getAuthHeaders, navigate]);

  const handleAddRecipe = useCallback(async (recipe: { name: string; productId: number; ingredients: Ingredient[]; quantity: number; unit: string }) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/recipes`, {
        method: 'POST',
        headers,
        body: JSON.stringify(recipe),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          console.error('[ProductDetails] Unauthorized, redirecting to login');
          navigate('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`Add recipe error: HTTP ${res.status}, ${text.slice(0, 50)}`);
      }
      const addedRecipe = await res.json();
      console.log('[ProductDetails] Added recipe:', addedRecipe);
      setRecipes([...recipes, addedRecipe]);
      setShowAddRecipeModal(false);
      setError(null);
    } catch (err: any) {
      console.error('[ProductDetails] Add recipe error:', err);
      setError('Failed to add recipe: ' + err.message);
    }
  }, [recipes, getAuthHeaders, navigate]);

  const addPackageType = useCallback(() => {
    setPackageTypes([...packageTypes, { type: '', price: '', isKegDepositItem: false }]);
  }, [packageTypes]);

  const removePackageType = useCallback((index: number) => {
    setPackageTypes(packageTypes.filter((_, i) => i !== index));
  }, [packageTypes]);

  const updatePackageType = useCallback((index: number, field: keyof PackageType, value: string | boolean) => {
    const updatedPackageTypes = [...packageTypes];
    updatedPackageTypes[index] = { ...updatedPackageTypes[index], [field]: value };
    setPackageTypes(updatedPackageTypes);
  }, [packageTypes]);

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
              <select
                value={product?.class || ''}
                onChange={(e) => {
                  const classValue = e.target.value as ProductClass;
                  const defaultType = classValue === ProductClass.Beer ? ProductType.MaltBeverage :
                    classValue === ProductClass.Wine ? ProductType.GrapeWine :
                    classValue === ProductClass.Spirits ? ProductType.NeutralSpirits : ProductType.MaltBeverage;
                  setProduct({
                    ...product!,
                    class: classValue,
                    type: defaultType,
                    style: undefined,
                    ibu: classValue === ProductClass.Spirits ? null : (product?.ibu ?? null),
                  });
                }}
                className="form-control"
              >
                <option value="">Select Class</option>
                {Object.values(ProductClass).map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Type:</label>
              <select
                value={product?.type || ''}
                onChange={(e) => {
                  const typeValue = e.target.value as ProductType;
                  setProduct({ ...product!, type: typeValue, style: undefined });
                }}
                className="form-control"
                disabled={!product?.class}
              >
                <option value="">Select Type</option>
                {product?.class &&
                  Object.values(ProductType)
                    .filter(type => {
                      if (product.class === ProductClass.Beer) {
                        return [ProductType.MaltBeverage, ProductType.Seltzer].includes(type);
                      } else if (product.class === ProductClass.Wine) {
                        return [
                          ProductType.GrapeWine,
                          ProductType.SparklingWine,
                          ProductType.CarbonatedWine,
                          ProductType.FruitWine,
                          ProductType.Cider,
                          ProductType.OtherAgriculturalWine,
                        ].includes(type);
                      } else if (product.class === ProductClass.Spirits) {
                        return [
                          ProductType.NeutralSpirits,
                          ProductType.Whisky,
                          ProductType.Gin,
                          ProductType.Vodka,
                          ProductType.Rum,
                          ProductType.Tequila,
                          ProductType.CordialsLiqueurs,
                          ProductType.FlavoredSpirits,
                          ProductType.DistilledSpiritsSpecialty,
                        ].includes(type);
                      }
                      return false;
                    })
                    .map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
              </select>
            </div>
            {product?.type && product.type !== ProductType.Vodka && product.type !== ProductType.NeutralSpirits && (
              <div>
                <label className="form-label">Style:</label>
                <select
                  value={product?.style || ''}
                  onChange={(e) => setProduct({ ...product!, style: e.target.value as Style })}
                  className="form-control"
                  disabled={!product?.type}
                >
                  <option value="">Select Style</option>
                  {styleOptions[product.type]?.map(style => (
                    <option key={style} value={style}>{style}</option>
                  ))}
                </select>
              </div>
            )}
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
            {product?.class !== ProductClass.Spirits && (
              <div>
                <label className="form-label">IBU:</label>
                <input
                  type="number"
                  value={product?.ibu ?? ''}
                  onChange={(e) => setProduct({ ...product!, ibu: parseInt(e.target.value) || null })}
                  placeholder="Enter IBU"
                  className="form-control"
                />
              </div>
            )}
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