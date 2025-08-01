import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Product } from '../types/interfaces';
import { ProductClass, ProductType, Style } from '../types/enums';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:10000';

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    abbreviation: '',
    enabled: 1,
    priority: 1,
    class: undefined,
    type: undefined,
    style: undefined,
    abv: 0,
    ibu: null,
  });

  const navigate = useNavigate();

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

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('[Products] No token found, redirecting to login');
      navigate('/login');
      return null;
    }
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [navigate]);

  const fetchProducts = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/products`, { headers });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          console.error('[Products] Unauthorized, redirecting to login');
          navigate('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`HTTP error! status: ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      console.log('[Products] Fetched products:', data);
      setProducts(data);
    } catch (err: any) {
      console.error('[Products] Fetch products error:', err);
      setError('Failed to fetch products: ' + err.message);
    }
  }, [getAuthHeaders, navigate]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (showAddModal) {
      console.log('[Modal] newProduct state:', { class: newProduct.class, ibu: newProduct.ibu });
    }
  }, [showAddModal, newProduct.class, newProduct.ibu]);

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

  const handleAddProduct = useCallback(async () => {
    if (!newProduct.name || !newProduct.abbreviation || !newProduct.class || !newProduct.type || !newProduct.style) {
      setError('Name, Abbreviation, Class, Type, and Style are required');
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      const serverClass = mapToServerClass(newProduct.class);
      const serverType = mapToServerType(newProduct.class, newProduct.type);
      const payload = {
        ...newProduct,
        class: serverClass,
        type: serverType,
        abv: newProduct.abv ? parseFloat(newProduct.abv.toString()) : 0,
        ibu: null,
      };
      console.log('[Products] Adding product:', payload);
      const res = await fetch(`${API_BASE_URL}/api/products`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          console.error('[Products] Unauthorized, redirecting to login');
          navigate('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`Failed to add product: HTTP ${res.status}, ${text.slice(0, 50)}`);
      }
      const addedProduct = await res.json();
      console.log('[Products] Added product:', addedProduct);
      setProducts([...products, addedProduct]);
      setShowAddModal(false);
      setNewProduct({
        name: '',
        abbreviation: '',
        enabled: 1,
        priority: 1,
        class: undefined,
        type: undefined,
        style: undefined,
        abv: 0,
        ibu: null,
      });
      setError(null);
    } catch (err: any) {
      console.error('[Products] Add product error:', err);
      setError('Failed to add product: ' + err.message);
    }
  }, [newProduct, products, getAuthHeaders, navigate]);

  const handleCancelAdd = useCallback(() => {
    console.log('[Products] Cancel add product');
    setShowAddModal(false);
    setNewProduct({
      name: '',
      abbreviation: '',
      enabled: 1,
      priority: 1,
      class: undefined,
      type: undefined,
      style: undefined,
      abv: 0,
      ibu: null,
    });
    setError(null);
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const promises = selectedProducts.map(id =>
        fetch(`${API_BASE_URL}/api/products/${id}`, {
          method: 'DELETE',
          headers,
        }).then(res => {
          if (!res.ok) {
            if (res.status === 401) {
              console.error('[Products] Unauthorized, redirecting to login');
              navigate('/login');
              throw new Error('Unauthorized');
            }
            throw new Error(`Failed to delete product ${id}: HTTP ${res.status}`);
          }
        })
      );
      await Promise.all(promises);
      console.log('[Products] Deleted products:', selectedProducts);
      setProducts(products.filter(p => !selectedProducts.includes(p.id)));
      setSelectedProducts([]);
    } catch (err: any) {
      console.error('[Products] Delete products error:', err);
      setError('Failed to delete products: ' + err.message);
    }
  }, [selectedProducts, products, getAuthHeaders, navigate]);

  console.log('[Products] Render:', {
    productsLength: products.length,
    isMobile: window.innerWidth <= 768 ? 'cards' : 'table',
    showAddModal,
    error,
    newProductClass: newProduct.class,
  });

  return (
    <div className="page-container container">
      <h2 className="app-header mb-4">Products</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="inventory-actions mb-4">
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          Add Product
        </button>
        <button
          className="btn btn-danger"
          onClick={handleDeleteSelected}
          disabled={selectedProducts.length === 0}
        >
          Delete Selected
        </button>
      </div>
      <div className="inventory-table-container">
        {products.length > 0 ? (
          <>
            <table className="inventory-table table table-striped">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === products.length && products.length > 0}
                      onChange={() =>
                        setSelectedProducts(
                          selectedProducts.length === products.length ? [] : products.map(p => p.id)
                        )
                      }
                    />
                  </th>
                  <th>Name</th>
                  <th>Abbreviation</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts([...selectedProducts, product.id]);
                          } else {
                            setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                          }
                        }}
                      />
                    </td>
                    <td>
                      <Link to={`/products/${product.id}`} className="text-primary text-decoration-underline">
                        {product.name}
                      </Link>
                    </td>
                    <td>{product.abbreviation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="products-card-list">
              {products.map((product) => (
                <div key={product.id} className="products-card-item card mb-2">
                  <div className="card-body">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProducts([...selectedProducts, product.id]);
                        } else {
                          setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                        }
                      }}
                      className="me-2"
                    />
                    <p className="card-text">
                      <strong>Name:</strong>{' '}
                      <Link to={`/products/${product.id}`} className="text-primary text-decoration-underline">
                        {product.name}
                      </Link>
                    </p>
                    <p className="card-text"><strong>Abbreviation:</strong> {product.abbreviation}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="alert alert-info text-center">No products found.</div>
        )}
      </div>
      {showAddModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000 }}>
          <div className="modal-dialog modal-content" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="modal-header">
              <h5 className="modal-title" style={{ color: '#555555' }}>Add New Product</h5>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 'bold', color: '#555555' }}>
                  Name (required):
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="Enter product name"
                  className="form-control"
                />
              </div>
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 'bold', color: '#555555' }}>
                  Abbreviation (required):
                </label>
                <input
                  type="text"
                  value={newProduct.abbreviation}
                  onChange={(e) => setNewProduct({ ...newProduct, abbreviation: e.target.value })}
                  placeholder="Enter abbreviation"
                  className="form-control"
                />
              </div>
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 'bold', color: '#555555' }}>
                  Class (required):
                </label>
                <select
                  value={newProduct.class || ''}
                  onChange={(e) => {
                    const classValue = e.target.value as ProductClass;
                    console.log('[Products] Class changed:', classValue);
                    setNewProduct({
                      ...newProduct,
                      class: classValue,
                      type: undefined,
                      style: undefined,
                      ibu: null,
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
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 'bold', color: '#555555' }}>
                  Type (required):
                </label>
                <select
                  value={newProduct.type || ''}
                  onChange={(e) => {
                    const typeValue = e.target.value as ProductType;
                    console.log('[Products] Type changed:', typeValue);
                    setNewProduct({
                      ...newProduct,
                      type: typeValue,
                      style: undefined,
                    });
                  }}
                  className="form-control"
                  disabled={!newProduct.class}
                >
                  <option value="">Select Type</option>
                  {newProduct.class &&
                    Object.values(ProductType)
                      .filter(type => {
                        if (newProduct.class === ProductClass.Beer) {
                          return [ProductType.MaltBeverage, ProductType.Seltzer].includes(type);
                        } else if (newProduct.class === ProductClass.Wine) {
                          return [
                            ProductType.GrapeWine,
                            ProductType.SparklingWine,
                            ProductType.CarbonatedWine,
                            ProductType.FruitWine,
                            ProductType.Cider,
                            ProductType.OtherAgriculturalWine,
                          ].includes(type);
                        } else if (newProduct.class === ProductClass.Spirits) {
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
              {newProduct.type && (
                <div className="mb-3">
                  <label className="form-label" style={{ fontWeight: 'bold', color: '#555555' }}>
                    Style (required):
                  </label>
                  <select
                    value={newProduct.style || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, style: e.target.value as Style })}
                    className="form-control"
                    disabled={!newProduct.type}
                  >
                    <option value="">Select Style</option>
                    {styleOptions[newProduct.type]?.map(style => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 'bold', color: '#555555' }}>
                  ABV %:
                </label>
                <input
                  type="number"
                  value={newProduct.abv || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, abv: parseFloat(e.target.value) || 0 })}
                  step="0.1"
                  min="0"
                  placeholder="Enter ABV %"
                  className="form-control"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleAddProduct}>
                Add
              </button>
              <button className="btn btn-danger" onClick={handleCancelAdd}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;