import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types/interfaces';

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log('Fetched products:', data);
        setProducts(data);
      } catch (err: any) {
        console.error('Fetch products error:', err);
      }
    };
    fetchProducts();
  }, [API_BASE_URL]);

  return (
    <div>
      <h2>Products</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Name</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Abbreviation</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
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