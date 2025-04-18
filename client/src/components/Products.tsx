import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types/interfaces';
import { ProductType, ProductClass } from '../types/enums';
import '../App.css';

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    abbreviation: '',
    enabled: true,
    priority: 1,
    class: '',
    productColor: '',
    type: '',
    style: '',
    abv: 0,
    ibu: 0,
  });
  const [filteredStyles, setFilteredStyles] = useState<string[]>([]);
  const [showStyleSuggestions, setShowStyleSuggestions] = useState(false);
  const [styles, setStyles] = useState<{ type: string; styles: string[] }[]>([]);
  const [stylesError, setStylesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setProducts(data);
      } catch (err: any) {
        console.error('Fetch products error:', err);
        setError(`Failed to load products: ${err.message}`);
      }
    };

    const fetchStyles = async () => {
      try {
        const res = await fetch('/styles.xml');
        if (!res.ok) throw new Error(`Failed to fetch styles.xml: ${res.status}`);
        const text = await res.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        const styleNodes = xmlDoc.getElementsByTagName('style');
        const styleList = Array.from(styleNodes).map(node => node.textContent || '');
        if (styleList.length === 0) throw new Error('No styles found in XML');

        // Map styles to ProductType
        const styleMap = [
          {
            type: ProductType.Malt,
            styles: styleList.filter(s => s.includes('Ale') || s.includes('Stout') || s.includes('Pilsner') || s.includes('Weisse') || s.includes('Saison') || s.includes('Lambic') || s.includes('Kölsch') || s.includes('Altbier')),
          },
          {
            type: ProductType.Spirits,
            styles: styleList.filter(s => s.includes('Whiskey') || s.includes('Gin') || s.includes('Vodka') || s.includes('Tequila') || s.includes('Mezcal') || s.includes('Rum') || s.includes('Brandy') || s.includes('Cognac') || s.includes('Armagnac') || s.includes('Pisco') || s.includes('Grappa')),
          },
          {
            type: ProductType.Wine,
            styles: styleList.filter(s => s.includes('Sauvignon') || s.includes('Merlot') || s.includes('Pinot') || s.includes('Syrah') || s.includes('Zinfandel') || s.includes('Chardonnay') || s.includes('Riesling') || s.includes('Rosé') || s.includes('Prosecco') || s.includes('Champagne') || s.includes('Lambrusco') || s.includes('Port') || s.includes('Sherry') || s.includes('Madeira') || s.includes('Marsala')),
          },
          {
            type: ProductType.Cider,
            styles: ['Cider'],
          },
          {
            type: ProductType.Seltzer,
            styles: ['Other'],
          },
          {
            type: ProductType.Merchandise,
            styles: ['Other'],
          },
        ];

        setStyles(styleMap);
        setFilteredStyles(styleMap.find(m => m.type === newProduct.type)?.styles || styleList);
        setStylesError(null);
      } catch (err: any) {
        console.error('Fetch styles error:', err);
        setStylesError(`Styles fetch failed: ${err.message}`);
        setStyles([{ type: ProductType.Malt, styles: ['Fallback Style'] }]);
        setFilteredStyles(['Fallback Style']);
      }
    };

    fetchProducts();
    fetchStyles();
  }, [API_BASE_URL, newProduct.type]);

  const handleAddProduct = async () => {
    console.log('Adding product:', newProduct);
    try {
      const res = await fetch(`${API_BASE_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct),
      });
      if (!res.ok) {
        const errorData = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, body: ${errorData}`);
      }
      const addedProduct = await res.json();
      console.log('Server response:', addedProduct);
      const updatedRes = await fetch(`${API_BASE_URL}/api/products`);
      if (!updatedRes.ok) throw new Error('Failed to refresh products');
      const updatedProducts = await updatedRes.json();
      setProducts(updatedProducts);
      setShowAddModal(false);
      setNewProduct({ name: '', abbreviation: '', enabled: true, priority: 1, class: '', productColor: '', type: '', style: '', abv: 0, ibu: 0 });
      setError(null);
    } catch (err: any) {
      console.error('Add product error:', err);
      setError(`Failed to add product: ${err.message}`);
    }
  };

  const handleCancelAdd = () => {
    setShowAddModal(false);
    setNewProduct({ name: '', abbreviation: '', enabled: true, priority: 1, class: '', productColor: '', type: '', style: '', abv: 0, ibu: 0 });
    setError(null);
  };

  const handleDeleteSelected = async () => {
    if (selectedProducts.length === 0) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/products`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedProducts }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const updatedProducts = products.filter(p => !selectedProducts.includes(p.id));
      setProducts(updatedProducts);
      setSelectedProducts([]);
      setError(null);
    } catch (err: any) {
      console.error('Delete products error:', err);
      setError(`Failed to delete products: ${err.message}`);
    }
  };

  return (
    <div className="page-container">
      <h2 style={{ color: '#EEC930', marginBottom: '20px', fontSize: '24px' }}>Products</h2>
      {error && (
        <div className="error">{error}</div>
      )}
      <div className="inventory-actions">
        <button
          onClick={() => setShowAddModal(true)}
          className="inventory-actions button"
        >
          Add Product
        </button>
        <button
          onClick={handleDeleteSelected}
          disabled={selectedProducts.length === 0}
          className="inventory-actions button"
          style={{
            backgroundColor: selectedProducts.length ? '#F86752' : '#ccc',
            cursor: selectedProducts.length ? 'pointer' : 'not-allowed',
          }}
        >
          Delete Selected
        </button>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
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
              width: '400px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ color: '#333', marginBottom: '15px', textAlign: 'center' }}>Add New Product</h3>
            {stylesError && <div className="error">{stylesError}</div>}
            {error && <div className="error">{error}</div>}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
                Name:
              </label>
              <input
                type="text"
                value={newProduct.name || ''}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                placeholder="e.g., Hoppy Red Ale"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
                Abbreviation:
              </label>
              <input
                type="text"
                value={newProduct.abbreviation || ''}
                onChange={(e) => setNewProduct({ ...newProduct, abbreviation: e.target.value })}
                placeholder="e.g., HRA"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
                Class:
              </label>
              <select
                value={newProduct.class || ''}
                onChange={(e) => setNewProduct({ ...newProduct, class: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                }}
              >
                <option value="">Select Class</option>
                {Object.values(ProductClass).map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
                Type:
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
                  setFilteredStyles(styles.find(s => s.type === type)?.styles || []);
                  setShowStyleSuggestions(true);
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                }}
              >
                <option value="">Select Type</option>
                {Object.values(ProductType).map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '15px', position: 'relative' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
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
                    setFilteredStyles(styles.find(s => s.type === newProduct.type)?.styles || []);
                  } else {
                    const filtered = (styles.find(s => s.type === newProduct.type)?.styles || []).filter(s => s.toLowerCase().includes(value.toLowerCase()));
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
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                  backgroundColor: (newProduct.type === ProductType.Seltzer || newProduct.type === ProductType.Merchandise) ? '#f0f0f0' : '#fff',
                }}
              />
              {showStyleSuggestions && newProduct.type !== ProductType.Seltzer && newProduct.type !== ProductType.Merchandise && (
                <ul
                  style={{
                    border: '1px solid #ddd',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    position: 'absolute',
                    backgroundColor: '#fff',
                    width: '100%',
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    zIndex: 1000,
                    borderRadius: '4px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  {filteredStyles.length > 0 ? (
                    filteredStyles.map((style) => (
                      <li
                        key={style}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setNewProduct({ ...newProduct, style });
                          setShowStyleSuggestions(false);
                        }}
                        style={{
                          padding: '8px 10px',
                          cursor: 'pointer',
                          backgroundColor: newProduct.style === style ? '#e0e0e0' : '#fff',
                          borderBottom: '1px solid #eee',
                        }}
                      >
                        {style}
                      </li>
                    ))
                  ) : (
                    <li style={{ padding: '8px 10px' }}>No matches found</li>
                  )}
                </ul>
              )}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
                ABV (%):
              </label>
              <input
                type="number"
                value={newProduct.abv || 0}
                onChange={(e) => setNewProduct({ ...newProduct, abv: parseFloat(e.target.value) || 0 })}
                step="0.1"
                min="0"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
                IBU (for Malt):
              </label>
              <input
                type="number"
                value={newProduct.ibu || 0}
                onChange={(e) => setNewProduct({ ...newProduct, ibu: parseInt(e.target.value) || 0 })}
                min="0"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
                Product Color:
              </label>
              <input
                type="text"
                value={newProduct.productColor || ''}
                onChange={(e) => setNewProduct({ ...newProduct, productColor: e.target.value })}
                placeholder="e.g., Golden"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={handleAddProduct}
                disabled={!newProduct.name || !newProduct.abbreviation || !newProduct.type || !newProduct.style}
                className="inventory-actions button"
                style={{
                  backgroundColor: newProduct.name && newProduct.abbreviation && newProduct.type && newProduct.style ? '#2196F3' : '#ccc',
                  cursor: newProduct.name && newProduct.abbreviation && newProduct.type && newProduct.style ? 'pointer' : 'not-allowed',
                }}
              >
                Add
              </button>
              <button
                onClick={handleCancelAdd}
                className="inventory-actions button"
                style={{
                  backgroundColor: '#F86752',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <table className="inventory-table">
        <thead>
          <tr>
            <th></th>
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
                <Link to={`/products/${product.id}`}>{product.name}</Link>
              </td>
              <td>{product.abbreviation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Products;