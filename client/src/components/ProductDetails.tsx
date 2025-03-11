import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Product, Recipe } from '../types/interfaces';

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

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
      }
    };

    const fetchRecipes = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products/${id}/recipes`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log('Fetched recipes:', data);
        setRecipes(data);
      } catch (err: any) {
        console.error('Fetch recipes error:', err);
      }
    };

    fetchProduct();
    fetchRecipes();
  }, [API_BASE_URL, id]);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>Product Details</h2>
      {product ? (
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Name:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                {product.name}
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Abbreviation:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                {product.abbreviation}
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Enabled:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: product.enabled ? '#e0f7e0' : '#ffe0e0', borderRadius: '4px' }}>
                {product.enabled ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Priority:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                {product.priority}
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Class:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                {product.class}
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Product Color:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                {product.productColor}
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Type:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                {product.type}
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>Style:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                {product.style}
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>ABV:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                {product.abv}%
              </span>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555' }}>IBU:</label>
              <span style={{ display: 'block', padding: '5px 10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
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
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Ingredients</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Instructions</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((recipe) => (
                  <tr key={recipe.id} style={{ backgroundColor: '#fff' }}>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{recipe.name}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{recipe.ingredients}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{recipe.instructions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#777', marginBottom: '20px' }}>No recipes available.</p>
          )}
          <button
            onClick={() => alert('Add New Recipe functionality coming soon')}
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
    </div>
  );
};

export default ProductDetails;