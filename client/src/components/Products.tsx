import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Product } from '../types/interfaces';
import { ProductClass, ProductType } from '../types/enums';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    abbreviation: '',
    enabled: true,
    priority: 1,
    class: '',
    type: '',
    style: '',
    abv: 0,
    ibu: 0,
  });
  const [filteredStyles, setFilteredStyles] = useState<string[]>([]);
  const [showStyleSuggestions, setShowStyleSuggestions] = useState(false);
  const [styles, setStyles] = useState<{ type: string; styles: string[] }[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setProducts(data);
      } catch (err: any) {
        setError('Failed to fetch products: ' + err.message);
      }
    };

    const fetchStyles = async () => {
      try {
        const res = await fetch('../../../config/styles.xml');
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const text = await res.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) throw new Error('Invalid XML format in styles.xml');
        const types = Array.from(xmlDoc.getElementsByTagName('Type')).map(type => ({
          type: type.getAttribute('name') || '',
          styles: Array.from(type.getElementsByTagName('Style')).map(style => style.textContent || '').filter(Boolean),
        }));
        setStyles(types);
        console.log('Fetched styles:', types);
      } catch (err: any) {
        console.error('Fetch styles error:', err);
        setError('Failed to load styles: ' + err.message);
        // Fallback to mock styles
        setStyles([
          { type: ProductType.Malt, styles: ['IPA', 'Stout', 'Porter', 'American Amber Ale'] },
          { type: ProductType.Spirits, styles: ['Bourbon', 'Whiskey', 'Vodka', 'Gin'] },
          { type: ProductType.Wine, styles: ['Red', 'White', 'Rosé'] },
          { type: ProductType.Cider, styles: ['Dry', 'Sweet'] },
          { type: ProductType.Seltzer, styles: ['Other'] },
          { type: ProductType.Merchandise, styles: ['Other'] },
        ]);
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
        ibu: newProduct.ibu ? parseInt(newProduct.ibu.toString(), 10) : 0,
      };
      const res = await fetch(`${API_BASE_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const addedProduct = await res.json();
      setProducts([...products, addedProduct]);
      setShowAddModal(false);
      setNewProduct({
        name: '',
        abbreviation: '',
        enabled: true,
        priority: 1,
        class: '',
        type: '',
        style: '',
        abv: 0,
        ibu: 0,
      });
      setError(null);
    } catch (err: any) {
      setError('Failed to add product: ' + err.message);
    }
  };

  const handleCancelAdd = () => {
    setShowAddModal(false);
    setNewProduct({
      name: '',
      abbreviation: '',
      enabled: true,
      priority: 1,
      class: '',
      type: '',
      style: '',
      abv: 0,
      ibu: 0,
    });
    setError(null);
  };

  return (
    <div className="page-container">
      <h2>Products</h2>
      {error && <div className="error">{error}</div>}
      <div className="inventory-actions">
        <button onClick={() => setShowAddModal(true)}>Add Product</button>
        <button
          disabled={selectedProducts.length === 0}
          style={selectedProducts.length === 0 ? { backgroundColor: '#CCCCCC', cursor: 'not-allowed' } : {}}
        >
          Delete Selected
        </button>
      </div>
      <div className="inventory-table-container">
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
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px', textAlign: 'center' }}>
              Add New Product
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
              {/* Name */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Name (required):
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="Enter product name"
                  style={{
                    width: '100%',
                    maxWidth: '350px',
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
              {/* Abbreviation */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Abbreviation:
                </label>
                <input
                  type="text"
                  value={newProduct.abbreviation}
                  onChange={(e) => setNewProduct({ ...newProduct, abbreviation: e.target.value })}
                  placeholder="Enter abbreviation"
                  style={{
                    width: '100%',
                    maxWidth: '350px',
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
              {/* Class */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Class (required):
                </label>
                <select
                  value={newProduct.class || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, class: e.target.value })}
                  style={{
                    width: '100%',
                    maxWidth: '350px',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="">Select Class</option>
                  {Object.values(ProductClass).map((cls) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              {/* Type */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
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
                    setShowStyleSuggestions(true);
                  }}
                  style={{
                    width: '100%',
                    maxWidth: '350px',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="">Select Type</option>
                  {Object.values(ProductType).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              {/* Style */}
              <div style={{ position: 'relative' }}>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
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
                  style={{
                    width: '100%',
                    maxWidth: '350px',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    backgroundColor: (newProduct.type === ProductType.Seltzer || newProduct.type === ProductType.Merchandise) ? '#f0f0f0' : '#FFFFFF',
                    color: '#000000',
                  }}
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
              {/* ABV */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  ABV %:
                </label>
                <input
                  type="number"
                  value={newProduct.abv || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, abv: parseFloat(e.target.value) || 0 })}
                  step="0.1"
                  min="0"
                  placeholder="Enter ABV %"
                  style={{
                    width: '100%',
                    maxWidth: '350px',
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
              {/* IBU */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  IBU:
                </label>
                <input
                  type="number"
                  value={newProduct.ibu || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, ibu: parseInt(e.target.value, 10) || 0 })}
                  step="1"
                  min="0"
                  placeholder="Enter IBU"
                  style={{
                    width: '100%',
                    maxWidth: '350px',
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
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button
                onClick={handleAddProduct}
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
                Add
              </button>
              <button
                onClick={handleCancelAdd}
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

export default Products;