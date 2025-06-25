import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types/interfaces';
import { ProductClass, ProductType } from '../types/enums';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

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
    class: '',
    type: undefined,
    style: '',
    abv: 0,
    ibu: null,
  });
  const [filteredStyles, setFilteredStyles] = useState<string[]>([]);
  const [showStyleSuggestions, setShowStyleSuggestions] = useState(false);
  const [styles, setStyles] = useState<{ type: string; styles: string[] }[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products`, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log('[Products] Fetched products:', data);
        setProducts(data);
      } catch (err: any) {
        setError('Failed to fetch products: ' + err.message);
        console.error('[Products] Fetch products error:', err);
      }
    };

    const fetchStyles = async () => {
      try {
        console.log('[Products] Fetching /styles.xml...');
        const res = await fetch('/styles.xml', { headers: { Accept: 'application/xml' } });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const text = await res.text();
        if (!text.trim()) throw new Error('Empty XML response');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) throw new Error('Invalid XML format: ' + parseError.textContent);

        const stylesByType: { type: string; styles: string[] }[] = [];
        let currentType = '';
        Array.from(xmlDoc.documentElement.childNodes).forEach(node => {
          if (node.nodeType === Node.COMMENT_NODE) {
            const comment = node.textContent?.trim().toLowerCase() || '';
            if (comment.includes('beer')) currentType = 'Malt';
            else if (comment.includes('wine')) currentType = 'Wine';
            else if (comment.includes('spirit')) currentType = 'Spirits';
            else if (comment.includes('cider')) currentType = 'Cider';
            else if (comment.includes('seltzer')) currentType = 'Seltzer';
            else if (comment.includes('merchandise')) currentType = 'Merchandise';
          } else if (node.nodeName === 'style' && currentType) {
            const styleText = node.textContent?.trim();
            if (styleText) {
              const typeEntry = stylesByType.find(entry => entry.type === currentType);
              if (typeEntry) {
                typeEntry.styles.push(styleText);
              } else {
                stylesByType.push({ type: currentType, styles: [styleText] });
              }
            }
          }
        });

        if (stylesByType.length === 0) throw new Error('No styles found in XML');
        console.log('[Products] Parsed styles:', stylesByType);
        setStyles(stylesByType);
      } catch (err: any) {
        console.error('[Products] Fetch styles error:', err);
        setError('Failed to load styles: ' + err.message);
        const mockStyles = [
          { type: 'Malt', styles: ['IPA', 'Stout', 'Porter', 'American Amber Ale'] },
          { type: 'Spirits', styles: ['Bourbon', 'Whiskey', 'Vodka', 'Gin'] },
          { type: 'Wine', styles: ['Red', 'White', 'Rosé'] },
          { type: 'Cider', styles: ['Dry', 'Sweet'] },
          { type: 'Seltzer', styles: ['Other'] },
          { type: 'Merchandise', styles: ['Other'] },
        ];
        setStyles(mockStyles);
        console.log('[Products] Set mock styles:', mockStyles);
      }
    };

    fetchProducts();
    fetchStyles();
  }, []);

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.class || !newProduct.type) {
      setError('Name, Class, and Type are required');
      return;
    }

    try {
      const payload = {
        ...newProduct,
        abv: newProduct.abv ? parseFloat(newProduct.abv.toString()) : 0,
        ibu: newProduct.class === ProductClass.Spirits ? null : (newProduct.ibu ? parseInt(newProduct.ibu.toString(), 10) : 0),
      };
      const res = await fetch(`${API_BASE_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
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
        class: '',
        type: undefined,
        style: '',
        abv: 0,
        ibu: null,
      });
      setError(null);
    } catch (err: any) {
      setError('Failed to add product: ' + err.message);
      console.error('[Products] Add product error:', err);
    }
  };

  const handleCancelAdd = () => {
    console.log('[Products] Cancel add product');
    setShowAddModal(false);
    setNewProduct({
      name: '',
      abbreviation: '',
      enabled: 1,
      priority: 1,
      class: '',
      type: undefined,
      style: '',
      abv: 0,
      ibu: null,
    });
    setError(null);
  };

  const handleDeleteSelected = async () => {
    try {
      const promises = selectedProducts.map(id =>
        fetch(`${API_BASE_URL}/api/products/${id}`, {
          method: 'DELETE',
          headers: { Accept: 'application/json' },
        }).then(res => {
          if (!res.ok) throw new Error(`Failed to delete product ${id}: HTTP ${res.status}`);
        })
      );
      await Promise.all(promises);
      console.log('[Products] Deleted products:', selectedProducts);
      setProducts(products.filter(p => !selectedProducts.includes(p.id)));
      setSelectedProducts([]);
    } catch (err: any) {
      setError('Failed to delete products: ' + err.message);
      console.error('[Products] Delete products error:', err);
    }
  };

  console.log('[Products] Render:', {
    productsLength: products.length,
    isMobile: window.innerWidth <= 768 ? 'cards' : 'table',
    showAddModal,
    error,
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
                  Abbreviation:
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
                  onChange={(e) => setNewProduct({ ...newProduct, class: e.target.value as ProductClass })}
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
                    const type = e.target.value as ProductType;
                    setNewProduct({
                      ...newProduct,
                      type,
                      style: type === ProductType.Seltzer || type === ProductType.Merchandise ? 'Other' : '',
                    });
                    const selectedStyles = styles.find(s => s.type.toLowerCase() === type.toLowerCase())?.styles || [];
                    setFilteredStyles(selectedStyles);
                    console.log('[Products] Type selected:', type, 'Filtered styles:', selectedStyles);
                    setShowStyleSuggestions(true);
                  }}
                  className="form-control"
                >
                  <option value="">Select Type</option>
                  {Object.values(ProductType).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3" style={{ position: 'relative' }}>
                <label className="form-label" style={{ fontWeight: 'bold', color: '#555555' }}>
                  Style:
                </label>
                <input
                  type="text"
                  value={newProduct.style || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewProduct({ ...newProduct, style: value });
                    setShowStyleSuggestions(true);
                    if (value.trim() === '') {
                      setFilteredStyles(styles.find(s => s.type.toLowerCase() === newProduct.type?.toLowerCase())?.styles || []);
                    } else {
                      const filtered = (styles.find(s => s.type.toLowerCase() === newProduct.type?.toLowerCase())?.styles || [])
                        .filter(s => s.toLowerCase().includes(value.toLowerCase()));
                      setFilteredStyles(filtered);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredStyles.length > 0) {
                      e.preventDefault();
                      setNewProduct({ ...newProduct, style: filteredStyles[0] });
                      setShowStyleSuggestions(false);
                    }
                  }}
                  placeholder="Type to search styles"
                  onFocus={() => setShowStyleSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowStyleSuggestions(false), 300)}
                  disabled={newProduct.type === ProductType.Seltzer || newProduct.type === ProductType.Merchandise}
                  className="form-control"
                />
                {showStyleSuggestions && newProduct.type !== ProductType.Seltzer && newProduct.type !== ProductType.Merchandise && (
                  <ul className="typeahead">
                    {filteredStyles.length > 0 ? (
                      filteredStyles.map((style) => (
                        <li
                          key={style}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setNewProduct({ ...newProduct, style });
                            setShowStyleSuggestions(false);
                          }}
                          className={newProduct.style === style ? 'selected' : ''}
                        >
                          {style}
                        </li>
                      ))
                    ) : (
                      <li style={{ padding: '8px 10px', color: '#888', borderBottom: '1px solid #eee' }}>
                        No matches found
                      </li>
                    )}
                  </ul>
                )}
              </div>
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
              {newProduct.class !== ProductClass.Spirits && (
                <div className="mb-3">
                  <label className="form-label" style={{ fontWeight: 'bold', color: '#555555' }}>
                    IBU:
                  </label>
                  <input
                    type="number"
                    value={newProduct.ibu || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, ibu: parseInt(e.target.value, 10) || 0 })}
                    step="1"
                    min="0"
                    placeholder="Enter IBU"
                    className="form-control"
                  />
                </div>
              )}
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