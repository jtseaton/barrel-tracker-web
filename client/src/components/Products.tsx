import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types/interfaces';
import { MaterialType, ProductClass } from '../types/enums';

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
  const [styles, setStyles] = useState<string[]>([]);
  const [stylesError, setStylesError] = useState<string | null>(null);
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
        if (styleList.length === 0) throw new Error('No styles found in XML—check structure');
        setStyles(styleList);
        setFilteredStyles(styleList); // Initial filter is full list
        setStylesError(null);
        } catch (err: any) {
        console.error('Fetch styles error:', err);
        setStylesError(`Styles fetch failed: ${err.message}`);
        setStyles(['Fallback Style']);
        setFilteredStyles(['Fallback Style']);
        }
    };
    
    fetchProducts();
    fetchStyles();
    }, [API_BASE_URL]);

    const handleAddProduct = async () => {
        console.log('Adding product:', newProduct); // Debug
        try {
          const res = await fetch(`${API_BASE_URL}/api/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProduct),
          });
          if (!res.ok) {
            const errorData = await res.text(); // Text for raw error
            throw new Error(`HTTP error! status: ${res.status}, body: ${errorData}`);
          }
          const addedProduct = await res.json();
          console.log('Server response:', addedProduct); // Debug
          const updatedRes = await fetch(`${API_BASE_URL}/api/products`);
          if (!updatedRes.ok) throw new Error('Failed to refresh products');
          const updatedProducts = await updatedRes.json();
          setProducts(updatedProducts);
          setShowAddModal(false);
          setNewProduct({ name: '', abbreviation: '', enabled: true, priority: 1, class: '', productColor: '', type: '', style: '', abv: 0, ibu: 0 });
        } catch (err: any) {
          console.error('Add product error:', err);
          alert(`Failed to add product: ${err.message}`); // User feedback
        }
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
    } catch (err: any) {
      console.error('Delete products error:', err);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>Products</h2>
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setShowAddModal(true)}
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
          Add Product
        </button>
        <button
          onClick={handleDeleteSelected}
          style={{
            backgroundColor: '#f44336',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
            marginLeft: '10px',
            transition: 'background-color 0.3s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#da190b')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f44336')}
          disabled={selectedProducts.length === 0}
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
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        width: '400px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <h3 style={{ color: '#333', marginBottom: '15px' }}>Add New Product</h3>
      {stylesError && <p style={{ color: '#f44336' }}>{stylesError}</p>}
      {/* Other fields up to Type unchanged */}
      <label style={{ display: 'block', marginBottom: '10px' }}>
        Type:
        <select
          value={newProduct.type || ''}
          onChange={(e) => setNewProduct({ ...newProduct, type: e.target.value })}
          style={{
            width: '100%',
            padding: '5px',
            marginTop: '5px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxSizing: 'border-box',
          }}
        >
          <option value="">Select Type</option>
          {Object.values(MaterialType).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <div style={{ position: 'relative', marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
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
              setFilteredStyles(styles);
            } else {
              const filtered = styles.filter(s => s.toLowerCase().includes(value.toLowerCase()));
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
          style={{
            width: '100%',
            padding: '5px',
            marginTop: '5px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxSizing: 'border-box',
          }}
        />
        {showStyleSuggestions && (
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
      {/* Rest of the fields (ABV, IBU/Proof, buttons) unchanged */}
    </div>
  </div>
)}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f0f0f0' }}>
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}></th>
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Name</th>
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Abbreviation</th>
          </tr>
        </thead>
        <tbody>
        {products.map((product) => (
  <tr key={product.id} style={{ backgroundColor: '#fff' }}>
    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
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
    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
      <Link to={`/products/${product.id}`}>{product.name}</Link>
    </td>
    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{product.abbreviation}</td>
  </tr>
))}
        </tbody>
      </table>
    </div>
  );
};

export default Products;