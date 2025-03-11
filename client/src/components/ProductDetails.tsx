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
    <div>
      <h2>Product Details</h2>
      {product ? (
        <div>
          <label>Name: <input type="text" value={product.name} readOnly style={{ width: '200px' }} /></label><br />
          <label>Abbreviation: <input type="text" value={product.abbreviation} readOnly style={{ width: '100px' }} /></label><br />
          <label>Enabled: <input type="checkbox" checked={product.enabled} readOnly /></label><br />
          <label>Priority: <input type="number" value={product.priority} readOnly style={{ width: '50px' }} /></label><br />
          <label>Class: <input type="text" value={product.class} readOnly style={{ width: '150px' }} /></label><br />
          <label>Product Color: <input type="text" value={product.productColor} readOnly style={{ width: '150px' }} /></label><br />
          <label>Type: <input type="text" value={product.type} readOnly style={{ width: '150px' }} /></label><br />
          <label>Style: <input type="text" value={product.style} readOnly style={{ width: '150px' }} /></label><br />
          <label>ABV: <input type="number" value={product.abv} readOnly step="0.1" style={{ width: '50px' }} />%</label><br />
          <label>IBU: <input type="number" value={product.ibu} readOnly style={{ width: '50px' }} /></label><br />

          <h3>Recipes</h3>
          {recipes.length > 0 ? (
            <ul>
              {recipes.map((recipe) => (
                <li key={recipe.id}>
                  {recipe.name} - {recipe.ingredients}
                </li>
              ))}
            </ul>
          ) : (
            <p>No recipes available.</p>
          )}
          <button onClick={() => alert('Add New Recipe functionality coming soon')}>
            Add New Recipe
          </button>
          <Link to="/products">Back to Products</Link>
        </div>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
};

export default ProductDetails;