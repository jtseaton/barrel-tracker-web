// src/components/Production.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Batch, Product, Recipe, Site, Ingredient, Equipment, InventoryItem } from '../types/interfaces';
import { Status, Unit, MaterialType, Account, ProductClass, BatchType } from '../types/enums';
import RecipeModal from './RecipeModal';
import '../App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:10000';

interface ProductionProps {
  inventory: InventoryItem[];
  refreshInventory: () => Promise<void>;
}

const Production: React.FC<ProductionProps> = ({ inventory, refreshInventory }) => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [items, setItems] = useState<{ name: string; type: string; enabled: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [newBatch, setNewBatch] = useState<Partial<Batch>>({
    batchId: '',
    productId: 0,
    recipeId: 0,
    siteId: '',
    fermenterId: null,
    batchType: undefined,
  });
  const [desiredVolume, setDesiredVolume] = useState<number>(0);
  const [desiredAbv, setDesiredAbv] = useState<number>(0);
  const [productClass, setProductClass] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [showBatchActionsModal, setShowBatchActionsModal] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const navigate = useNavigate();

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('[Production] No token found, redirecting to login');
      navigate('/login');
      return null;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        console.error('[Production] Token expired, redirecting to login', { exp: payload.exp, now });
        navigate('/login');
        return null;
      }
    } catch (err) {
      console.error('[Production] Token parsing error:', err);
      navigate('/login');
      return null;
    }
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [navigate]);

  const fetchBatches = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches?page=${page}&limit=10`, { headers });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          console.error('[Production] Unauthorized, redirecting to login');
          navigate('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`Failed to fetch batches: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      if (!Array.isArray(data.batches)) {
        console.error('Invalid batches data: expected array, got', data);
        throw new Error('Invalid batches response');
      }
      setBatches(data.batches);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      console.error('[Production] Fetch batches error:', err);
      setError('Failed to load batches: ' + err.message);
    }
  }, [page, getAuthHeaders, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      const headers = getAuthHeaders();
      if (!headers) return;
      try {
        const endpoints = [
          { url: `${API_BASE_URL}/api/products`, setter: setProducts, name: 'products' },
          { url: `${API_BASE_URL}/api/sites`, setter: setSites, name: 'sites' },
          { url: `${API_BASE_URL}/api/items`, setter: setItems, name: 'items' },
        ];
        const responses = await Promise.all(
          endpoints.map(({ url }) => fetch(url, { headers }))
        );
        for (let i = 0; i < responses.length; i++) {
          const res = responses[i];
          const { name, setter } = endpoints[i];
          if (!res.ok) {
            const text = await res.text();
            if (res.status === 401) {
              console.error('[Production] Unauthorized, redirecting to login');
              navigate('/login');
              throw new Error(`Unauthorized: ${name}`);
            }
            throw new Error(`Failed to fetch ${name}: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
          }
          const data = await res.json();
          if (!Array.isArray(data)) {
            console.error(`Invalid ${name} data: expected array, got`, data);
            throw new Error(`Invalid ${name} response`);
          }
          setter(data);
        }
        await fetchBatches();
      } catch (err: any) {
        console.error('[Production] Initial fetch error:', err);
        setError('Failed to load production data: ' + err.message);
      }
    };
    fetchData();
  }, [fetchBatches, getAuthHeaders, navigate]);

  const refreshProducts = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/products`, { headers });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          console.error('[Production] Unauthorized, redirecting to login');
          navigate('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`Failed to fetch products: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        console.error('Invalid products data: expected array, got', data);
        throw new Error('Invalid products response');
      }
      setProducts(data);
    } catch (err: any) {
      console.error('[Production] Refresh products error:', err);
      setError('Failed to refresh products: ' + err.message);
    }
  }, [getAuthHeaders, navigate]);

  useEffect(() => {
    if (newBatch.siteId) {
      const fetchFermenters = async () => {
        const headers = getAuthHeaders();
        if (!headers) return;
        try {
          const res = await fetch(`${API_BASE_URL}/api/equipment?siteId=${newBatch.siteId}&type=Fermenter`, { headers });
          if (!res.ok) {
            const text = await res.text();
            if (res.status === 401) {
              console.error('[Production] Unauthorized, redirecting to login');
              navigate('/login');
              throw new Error('Unauthorized');
            }
            throw new Error(`Failed to fetch fermenters: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
          }
          const data = await res.json();
          if (!Array.isArray(data)) {
            console.error('Invalid fermenters data: expected array, got', data);
            setError('Invalid fermenters response');
            setEquipment([]);
            return;
          }
          setEquipment(data.filter(item => item && typeof item === 'object' && 'equipmentId' in item && 'name' in item));
        } catch (err: any) {
          console.error('[Production] Fetch fermenters error:', err);
          setError('Failed to load fermenters: ' + err.message);
          setEquipment([]);
        }
      };
      fetchFermenters();
    } else {
      setEquipment([]);
    }
  }, [newBatch.siteId, getAuthHeaders, navigate]);

  const fetchRecipes = useCallback(async (productId: number) => {
    if (!productId) {
      setRecipes([]);
      return;
    }
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/recipes?productId=${productId}`, { headers });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          console.error('[Production] Unauthorized, redirecting to login');
          navigate('/login');
          throw new Error('Unauthorized');
        }
        throw new Error(`Failed to fetch recipes: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        console.error('Invalid recipes data: expected array, got', data);
        throw new Error('Invalid recipes response');
      }
      setRecipes(data);
    } catch (err: any) {
      console.error('[Production] Fetch recipes error:', err);
      setError('Failed to fetch recipes: ' + err.message);
      setRecipes([]);
    }
  }, [getAuthHeaders, navigate]);

  useEffect(() => {
    const fetchProductClass = async () => {
      if (newBatch.productId) {
        const headers = getAuthHeaders();
        if (!headers) return;
        try {
          const res = await fetch(`${API_BASE_URL}/api/products/${newBatch.productId}`, { headers });
          if (!res.ok) {
            const text = await res.text();
            if (res.status === 401) {
              console.error('[Production] Unauthorized, redirecting to login');
              navigate('/login');
              throw new Error('Unauthorized');
            }
            throw new Error(`Failed to fetch product: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
          }
          const product = await res.json();
          setProductClass(product.class);
          if (product.class !== ProductClass.Spirits || newBatch.batchType === BatchType.Fermentation) {
            await fetchRecipes(newBatch.productId);
          } else {
            setRecipes([]);
            setNewBatch({ ...newBatch, recipeId: 0 });
          }
        } catch (err: any) {
          console.error('[Production] Fetch product class error:', err);
          setError('Failed to load product details: ' + err.message);
        }
      } else {
        setProductClass(null);
        setRecipes([]);
      }
    };
    fetchProductClass();
  }, [newBatch.productId, newBatch.batchType, fetchRecipes, getAuthHeaders, navigate]);

  const calculateSpiritsRequirements = () => {
    if (!desiredVolume || !desiredAbv) return { spiritVolume: 0, waterVolume: 0 };
    const spiritProof = 190; // Neutral Grain
    const desiredProof = desiredAbv * 2;
    const spiritVolume = (desiredVolume * desiredProof) / spiritProof;
    const waterVolume = desiredVolume - spiritVolume;
    return { spiritVolume: Number(spiritVolume.toFixed(2)), waterVolume: Number(waterVolume.toFixed(2)) };
  };

  const handleAddBatch = async () => {
    if (!newBatch.batchId || !newBatch.productId || !newBatch.siteId) {
      setError('Batch ID, Product, and Site are required');
      setShowErrorPopup(true);
      setShowAddBatchModal(false);
      return;
    }

    if (productClass === ProductClass.Spirits && !newBatch.batchType) {
      setError('Batch Type is required for spirits');
      setShowErrorPopup(true);
      setShowAddBatchModal(false);
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      console.log('[Production] Refreshing inventory before batch creation', { siteId: newBatch.siteId });
      await refreshInventory();

      const product = products.find(p => p.id === newBatch.productId);
      if (!product) {
        setError('Invalid product selected');
        setShowErrorPopup(true);
        setShowAddBatchModal(false);
        return;
      }

      let batchData: {
        batchId: string;
        productId: number;
        recipeId?: number | null;
        siteId: string;
        fermenterId: number | null;
        status: string;
        date: string;
        volume: number;
        batchType?: string;
      };

      const isFermentationBatch = productClass !== ProductClass.Spirits || newBatch.batchType === BatchType.Fermentation;

      if (isFermentationBatch) {
        if (!newBatch.recipeId) {
          setError('Recipe is required for fermentation batches');
          setShowErrorPopup(true);
          setShowAddBatchModal(false);
          return;
        }

        const recipe = recipes.find(r => r.id === newBatch.recipeId);
        if (!recipe) {
          setError('Invalid recipe selected');
          setShowErrorPopup(true);
          setShowAddBatchModal(false);
          return;
        }

        if (!recipe.ingredients || recipe.ingredients.length === 0) {
          setError('Selected recipe has no ingredients. Please add ingredients to the recipe in Product Details.');
          setShowErrorPopup(true);
          setShowAddBatchModal(false);
          return;
        }

        const invalidIngredients = recipe.ingredients.filter((ing: Ingredient) => {
          const inventoryItem = inventory.find(i =>
            i.item === ing.itemName &&
            i.status === 'Stored' &&
            i.siteId === newBatch.siteId &&
            (i.type === MaterialType.Spirits ? i.account === Account.Storage : true) &&
            parseFloat(i.quantity) >= ing.quantity &&
            i.unit === ing.unit
          );
          console.log('[Production] Checking batch ingredient:', {
            itemName: ing.itemName,
            siteId: newBatch.siteId,
            requiredQuantity: ing.quantity,
            unit: ing.unit,
            inventoryItem: inventoryItem ? {
              identifier: inventoryItem.identifier,
              type: inventoryItem.type,
              account: inventoryItem.account,
              status: inventoryItem.status,
              siteId: inventoryItem.siteId,
              quantity: inventoryItem.quantity,
              unit: inventoryItem.unit,
            } : null,
          });
          return !inventoryItem;
        });

        if (invalidIngredients.length > 0) {
          const errorMessage = `Insufficient inventory: ${invalidIngredients.map((i: Ingredient) => `${i.itemName} (${i.quantity} ${i.unit})`).join(', ')} not available at site ${newBatch.siteId}. Please add inventory at Madison Brewery.`;
          console.log('[Production] Batch validation error:', errorMessage);
          setError(errorMessage);
          setShowErrorPopup(true);
          setShowAddBatchModal(false);
          return;
        }

        batchData = {
          batchId: newBatch.batchId,
          productId: newBatch.productId,
          recipeId: newBatch.recipeId,
          siteId: newBatch.siteId,
          fermenterId: newBatch.fermenterId || null,
          status: Status.Processing,
          date: new Date().toISOString().split('T')[0],
          volume: recipe.unit.toLowerCase() === 'barrels' ? recipe.quantity : 20,
          batchType: newBatch.batchType || BatchType.Fermentation,
        };
      } else {
        if (!desiredVolume || !desiredAbv) {
          setError('Desired Volume and ABV are required for proofing batches');
          setShowErrorPopup(true);
          setShowAddBatchModal(false);
          return;
        }

        const { spiritVolume, waterVolume } = calculateSpiritsRequirements();
        const spiritProof = 190;
        const proofGallons = (spiritVolume * spiritProof) / 100;

        const spiritItem = inventory.find(i =>
          i.identifier === '321654987' &&
          i.status === 'Stored' &&
          i.siteId === newBatch.siteId &&
          i.type === MaterialType.Spirits &&
          i.account === Account.Storage &&
          parseFloat(i.quantity) >= spiritVolume
        );

        if (!spiritItem) {
          setError(`Insufficient Neutral Grain (Lot 321654987) at site ${newBatch.siteId}. Need ${spiritVolume} gallons.`);
          setShowErrorPopup(true);
          setShowAddBatchModal(false);
          return;
        }

        batchData = {
          batchId: newBatch.batchId,
          productId: newBatch.productId,
          recipeId: null,
          siteId: newBatch.siteId,
          fermenterId: newBatch.fermenterId || null,
          status: Status.Processing,
          date: new Date().toISOString().split('T')[0],
          volume: desiredVolume,
          batchType: BatchType.Proofing,
        };
      }

      console.log('[Production] Sending batch data:', batchData);

      const resBatch = await fetch(`${API_BASE_URL}/api/batches`, {
        method: 'POST',
        headers,
        body: JSON.stringify(batchData),
      });

      if (!resBatch.ok) {
        const text = await resBatch.text();
        let errorMessage = `Failed to add batch: HTTP ${resBatch.status}, ${text.slice(0, 50)}`;
        if (resBatch.status === 401) {
          console.error('[Production] Unauthorized batch creation, redirecting to login');
          navigate('/login');
          throw new Error('Unauthorized');
        }
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
        } catch {
          console.error('[Production] Failed to parse batch error:', text);
        }
        console.log('[Production] Batch creation error:', errorMessage);
        setErrorMessage(errorMessage);
        setShowErrorPopup(true);
        setShowAddBatchModal(false);
        throw new Error(errorMessage);
      }

      const newBatchResponse = await resBatch.json();
      console.log('[Production] Added batch:', newBatchResponse);

      if (isFermentationBatch) {
        const recipe = recipes.find(r => r.id === newBatch.recipeId);
        if (recipe && recipe.ingredients && recipe.ingredients.length > 0) {
          for (const ing of recipe.ingredients) {
            const ingredientData: Ingredient = {
              itemName: ing.itemName,
              quantity: ing.quantity,
              unit: ing.unit,
              isRecipe: true,
            };
            console.log('[Production] Adding ingredient to batch:', {
              batchId: newBatchResponse.batchId,
              ingredient: ingredientData,
            });
            const resIngredient = await fetch(`${API_BASE_URL}/api/batches/${newBatchResponse.batchId}/ingredients`, {
              method: 'POST',
              headers,
              body: JSON.stringify(ingredientData),
            });
            if (!resIngredient.ok) {
              const text = await resIngredient.text();
              let errorMessage = `Failed to add ingredient: HTTP ${resIngredient.status}, ${text.slice(0, 50)}`;
              if (resIngredient.status === 401) {
                console.error('[Production] Unauthorized ingredient addition, redirecting to login');
                navigate('/login');
                throw new Error('Unauthorized');
              }
              try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.error || errorMessage;
              } catch {
                console.error('[Production] Failed to parse ingredient error:', text);
              }
              console.log('[Production] Ingredient addition error:', errorMessage);
              setErrorMessage(errorMessage);
              setShowErrorPopup(true);
              setShowAddBatchModal(false);
              throw new Error(errorMessage);
            }
            console.log('[Production] Added ingredient:', await resIngredient.json());
          }
        }
      } else {
        const { spiritVolume, waterVolume } = calculateSpiritsRequirements();
        const spiritProof = 190;
        const proofGallons = (spiritVolume * spiritProof) / 100;
        const ingredients: Ingredient[] = [
          {
            itemName: 'Neutral Grain',
            quantity: spiritVolume,
            unit: Unit.Gallons,
            proof: spiritProof,
            proofGallons: proofGallons,
            isRecipe: false,
          },
          {
            itemName: 'Water',
            quantity: waterVolume,
            unit: Unit.Gallons,
            isRecipe: false,
          },
        ];
        for (const ing of ingredients) {
          console.log('[Production] Adding ingredient to batch:', {
            batchId: newBatchResponse.batchId,
            ingredient: ing,
          });
          const resIngredient = await fetch(`${API_BASE_URL}/api/batches/${newBatchResponse.batchId}/ingredients`, {
            method: 'POST',
            headers,
            body: JSON.stringify(ing),
          });
          if (!resIngredient.ok) {
            const text = await resIngredient.text();
            let errorMessage = `Failed to add ingredient: HTTP ${resIngredient.status}, ${text.slice(0, 50)}`;
            if (resIngredient.status === 401) {
              console.error('[Production] Unauthorized ingredient addition, redirecting to login');
              navigate('/login');
              throw new Error('Unauthorized');
            }
            try {
              const errorData = JSON.parse(text);
              errorMessage = errorData.error || errorMessage;
            } catch {
              console.error('[Production] Failed to parse ingredient error:', text);
            }
            console.log('[Production] Ingredient addition error:', errorMessage);
            setErrorMessage(errorMessage);
            setShowErrorPopup(true);
            setShowAddBatchModal(false);
            throw new Error(errorMessage);
          }
          console.log('[Production] Added ingredient:', await resIngredient.json());
        }

        const moveData = {
          identifier: '321654987',
          toAccount: Account.Production,
          proofGallons: proofGallons.toString(),
        };
        const resMove = await fetch(`${API_BASE_URL}/api/inventory/move`, {
          method: 'POST',
          headers,
          body: JSON.stringify(moveData),
        });
        if (!resMove.ok) {
          const text = await resMove.text();
          if (resMove.status === 401) {
            console.error('[Production] Unauthorized move, redirecting to login');
            navigate('/login');
            throw new Error('Unauthorized');
          }
          throw new Error(`Failed to move spirit: HTTP ${resMove.status}, ${text.slice(0, 50)}`);
        }
      }

      setShowAddBatchModal(false);
      setNewBatch({ batchId: '', productId: 0, recipeId: 0, siteId: '', fermenterId: null, batchType: undefined });
      setDesiredVolume(0);
      setDesiredAbv(0);
      setRecipes([]);
      setEquipment([]);
      await refreshInventory();
      await fetchBatches();
      setError(null);
      setErrorMessage(null);
      setShowErrorPopup(false);
    } catch (err: any) {
      console.error('[Production] Add batch error:', err);
      const errorMessage = err.message || 'Unknown error';
      setError('Failed to add batch: ' + errorMessage);
      setShowErrorPopup(true);
      setShowAddBatchModal(false);
    }
  };

  const handleAddRecipe = async (recipe: { name: string; productId: number; ingredients: Ingredient[]; quantity: number; unit: string }) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      console.log('[Production] Creating recipe:', recipe);
      const res = await fetch(`${API_BASE_URL}/api/recipes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: recipe.name,
          productId: recipe.productId,
          quantity: recipe.quantity,
          unit: recipe.unit,
          ingredients: recipe.ingredients.map(ing => ({
            itemName: ing.itemName,
            quantity: ing.quantity,
            unit: ing.unit,
          })),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let errorMessage = `Failed to add recipe: HTTP ${res.status}, ${text.slice(0, 50)}`;
        if (res.status === 401) {
          console.error('[Production] Unauthorized recipe creation, redirecting to login');
          navigate('/login');
          throw new Error('Unauthorized');
        }
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
        } catch {
          console.error('[Production] Recipe error:', text);
        }
        throw new Error(errorMessage);
      }
      const addedRecipe = await res.json();
      console.log('[Production] Added recipe:', addedRecipe);
      setRecipes([...recipes, addedRecipe]);
      await fetchRecipes(recipe.productId);
      setShowAddRecipeModal(false);
      setError(null);
      setShowErrorPopup(false);
    } catch (err: any) {
      console.error('[Production] Add recipe error:', err);
      const errorMessage = err.message || 'Unknown error';
      setError('Failed to save recipe: ' + err.message);
      setShowErrorPopup(true);
    }
  };

  const handleBatchSelection = (batchId: string) => {
    setSelectedBatchIds(prev =>
      prev.includes(batchId) ? prev.filter(id => id !== batchId) : [...prev, batchId]
    );
  };

  const handleOpenBatchActions = () => {
    if (selectedBatchIds.length > 0) {
      setShowBatchActionsModal(true);
    }
  };

  const handleCompleteBatches = async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const promises = selectedBatchIds.map(batchId =>
        fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: Status.Completed }),
        }).then(res => {
          if (!res.ok) {
            if (res.status === 401) {
              console.error('[Production] Unauthorized batch completion, redirecting to login');
              navigate('/login');
              throw new Error('Unauthorized');
            }
            throw new Error(`Failed to complete batch ${batchId}: HTTP ${res.status}`);
          }
          return res.json();
        })
      );
      await Promise.all(promises);
      await fetchBatches();
      setSelectedBatchIds([]);
      setShowBatchActionsModal(false);
      setError(null);
    } catch (err: any) {
      console.error('[Production] Complete batches error:', err);
      setError('Failed to complete batches: ' + err.message);
    }
  };

  const handleDeleteBatches = async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const promises = selectedBatchIds.map(batchId =>
        fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
          method: 'DELETE',
          headers,
        }).then(res => {
          if (!res.ok) {
            if (res.status === 401) {
              console.error('[Production] Unauthorized batch deletion, redirecting to login');
              navigate('/login');
              throw new Error('Unauthorized');
            }
            throw new Error(`Failed to delete batch ${batchId}: HTTP ${res.status}`);
          }
        })
      );
      await Promise.all(promises);
      await fetchBatches();
      setSelectedBatchIds([]);
      setShowBatchActionsModal(false);
      setError(null);
    } catch (err: any) {
      console.error('[Production] Delete batches error:', err);
      setError('Failed to delete batches: ' + err.message);
    }
  };

  const filteredBatches = React.useMemo(() =>
    batches.filter(batch =>
      batch.batchId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (batch.productName && batch.productName.toLowerCase().includes(searchQuery.toLowerCase()))
    ), [batches, searchQuery]);

  const { spiritVolume, waterVolume } = calculateSpiritsRequirements();

  return (
    <div className="page-container container">
      <h2 className="app-header mb-4">Production</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="inventory-actions mb-4">
        <button
          className="btn btn-primary"
          onClick={() => {
            console.log('[Production] Add New Batch button clicked');
            setShowAddBatchModal(true);
          }}
        >
          Add New Batch
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            console.log('[Production] Add Recipe button clicked');
            refreshProducts().then(() => setShowAddRecipeModal(true));
          }}
        >
          Add Recipe
        </button>
        <button
          className="btn btn-primary"
          onClick={handleOpenBatchActions}
          disabled={selectedBatchIds.length === 0}
        >
          Batch Actions
        </button>
      </div>
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by Batch ID or Product Name"
          className="form-control"
        />
      </div>
      <div className="inventory-table-container">
        {filteredBatches.length > 0 ? (
          <>
            <table className="inventory-table table table-striped">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedBatchIds.length === filteredBatches.length && filteredBatches.length > 0}
                      onChange={() =>
                        setSelectedBatchIds(
                          selectedBatchIds.length === filteredBatches.length
                            ? []
                            : filteredBatches.map(b => b.batchId)
                        )
                      }
                    />
                  </th>
                  <th>Batch ID</th>
                  <th>Product</th>
                  <th>Site</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map(batch => (
                  <tr key={batch.batchId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedBatchIds.includes(batch.batchId)}
                        onChange={() => handleBatchSelection(batch.batchId)}
                      />
                    </td>
                    <td>
                      <Link to={`/production/${batch.batchId}`} className="text-primary">
                        {batch.batchId}
                      </Link>
                    </td>
                    <td>{batch.productName || 'Unknown'}</td>
                    <td>{batch.siteName || batch.siteId}</td>
                    <td>{batch.status}</td>
                    <td>{batch.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="batch-list">
              {filteredBatches.map(batch => (
                <div key={batch.batchId} className="batch-card-body card mb-3">
                  <div className="card-body">
                    <input
                      type="checkbox"
                      checked={selectedBatchIds.includes(batch.batchId)}
                      onChange={() => handleBatchSelection(batch.batchId)}
                      className="me-2"
                    />
                    <h5 className="card-title">
                      <Link to={`/production/${batch.batchId}`} className="text-primary">
                        {batch.batchId}
                      </Link>
                    </h5>
                    <p className="card-text"><strong>Product:</strong> {batch.productName || 'Unknown'}</p>
                    <p className="card-text"><strong>Site:</strong> {batch.siteName || batch.siteId}</p>
                    <p className="card-text"><strong>Status:</strong> {batch.status}</p>
                    <p className="card-text"><strong>Date:</strong> {batch.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="alert alert-info text-center">No batches found.</div>
        )}
      </div>
      <div className="d-flex justify-content-between mt-3">
        <button
          className="btn btn-secondary"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Previous
        </button>
        <span>Page {page} of {totalPages}</span>
        <button
          className="btn btn-secondary"
          onClick={() => setPage(p => p + 1)}
          disabled={page === totalPages}
        >
          Next
        </button>
      </div>
      <RecipeModal
        show={showAddRecipeModal}
        onClose={() => {
          setShowAddRecipeModal(false);
          setError(null);
        }}
        onSave={handleAddRecipe}
        products={products}
        items={items}
      />
      {showAddBatchModal && (
        <div
          className="modal"
          style={{
            display: 'block',
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 2100,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '500px',
              margin: '100px auto',
              backgroundColor: '#fff',
              borderRadius: '8px',
              padding: '20px',
            }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #ddd', marginBottom: '15px' }}>
              <h5 style={{ color: '#555', margin: 0 }}>Add New Batch</h5>
            </div>
            <div className="modal-body">
              <div className="recipe-form">
                <label className="form-label" style={{ fontWeight: 'bold', color: '#555' }}>
                  Batch ID (required):
                  <input
                    type="text"
                    value={newBatch.batchId || ''}
                    onChange={e => setNewBatch({ ...newBatch, batchId: e.target.value })}
                    placeholder="Enter batch ID"
                    className="form-control"
                  />
                </label>
                <label className="form-label" style={{ fontWeight: 'bold', color: '#555' }}>
                  Product (required):
                  <select
                    value={newBatch.productId || ''}
                    onChange={e => {
                      const productId = parseInt(e.target.value, 10);
                      setNewBatch({ ...newBatch, productId, recipeId: 0, batchType: undefined });
                      setDesiredVolume(0);
                      setDesiredAbv(0);
                    }}
                    className="form-control"
                  >
                    <option value="">Select Product</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>
                {productClass === ProductClass.Spirits && (
                  <label className="form-label" style={{ fontWeight: 'bold', color: '#555' }}>
                    Batch Type (required):
                    <select
                      value={newBatch.batchType || ''}
                      onChange={e => setNewBatch({ ...newBatch, batchType: e.target.value as BatchType })}
                      className="form-control"
                    >
                      <option value="">Select Batch Type</option>
                      <option value={BatchType.Fermentation}>Fermentation</option>
                      <option value={BatchType.Proofing}>Proofing</option>
                    </select>
                  </label>
                )}
                {productClass === ProductClass.Spirits && newBatch.batchType === BatchType.Proofing ? (
                  <>
                    <label className="form-label" style={{ fontWeight: 'bold', color: '#555' }}>
                      Desired Batch Volume (gallons, required):
                      <input
                        type="number"
                        value={desiredVolume || ''}
                        onChange={e => setDesiredVolume(parseFloat(e.target.value) || 0)}
                        placeholder="Enter volume (e.g., 150)"
                        step="0.1"
                        min="0"
                        className="form-control"
                      />
                    </label>
                    <label className="form-label" style={{ fontWeight: 'bold', color: '#555' }}>
                      Desired ABV % (required):
                      <input
                        type="number"
                        value={desiredAbv || ''}
                        onChange={e => setDesiredAbv(parseFloat(e.target.value) || 0)}
                        placeholder="Enter ABV (e.g., 40)"
                        step="0.1"
                        min="0"
                        className="form-control"
                      />
                    </label>
                    {desiredVolume > 0 && desiredAbv > 0 && (
                      <div className="mt-3">
                        <p><strong>Requirements:</strong></p>
                        <p>Neutral Grain (190 proof): {spiritVolume} gallons</p>
                        <p>Water: {waterVolume} gallons</p>
                      </div>
                    )}
                  </>
                ) : (
                  <label className="form-label" style={{ fontWeight: 'bold', color: '#555' }}>
                    Recipe (required):
                    <select
                      value={newBatch.recipeId || ''}
                      onChange={e => setNewBatch({ ...newBatch, recipeId: parseInt(e.target.value, 10) })}
                      disabled={!newBatch.productId}
                      className="form-control"
                    >
                      <option value="">Select Recipe</option>
                      {recipes.map(recipe => (
                        <option key={recipe.id} value={recipe.id}>
                          {recipe.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="form-label" style={{ fontWeight: 'bold', color: '#555' }}>
                  Site (required):
                  <select
                    value={newBatch.siteId || ''}
                    onChange={e => setNewBatch({ ...newBatch, siteId: e.target.value })}
                    className="form-control"
                  >
                    <option value="">Select Site</option>
                    {sites.map(site => (
                      <option key={site.siteId} value={site.siteId}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-label" style={{ fontWeight: 'bold', color: '#555' }}>
                  Fermenter (optional):
                  <select
                    value={newBatch.fermenterId || ''}
                    onChange={e => {
                      const value = e.target.value;
                      setNewBatch({ ...newBatch, fermenterId: value ? parseInt(e.target.value, 10) : null });
                    }}
                    disabled={!newBatch.siteId || equipment.length === 0}
                    className="form-control"
                  >
                    <option value="">Select Fermenter (optional)</option>
                    {equipment.map(item => (
                      <option key={item.equipmentId} value={item.equipmentId}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #ddd', marginTop: '15px' }}>
              <button onClick={handleAddBatch} className="btn btn-primary">
                Create
              </button>
              <button
                onClick={() => {
                  console.log('[Production] Batch modal Cancel clicked');
                  setShowAddBatchModal(false);
                  setNewBatch({ batchId: '', productId: 0, recipeId: 0, siteId: '', fermenterId: null, batchType: undefined });
                  setDesiredVolume(0);
                  setDesiredAbv(0);
                  setError(null);
                }}
                className="btn btn-danger"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showErrorPopup && (
        <div className="modal" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2100 }}>
          <div className="modal-content" style={{ maxWidth: '500px', margin: '100px auto', backgroundColor: '#fff', borderRadius: '8px', padding: '20px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #ddd', marginBottom: '15px' }}>
              <h5 className="modal-title text-danger">Error</h5>
            </div>
            <div className="modal-body">
              <p>{errorMessage || error}</p>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #ddd', marginTop: '15px' }}>
              <button
                onClick={() => {
                  setShowErrorPopup(false);
                  setErrorMessage(null);
                  setError(null);
                  setShowAddBatchModal(false);
                }}
                className="btn btn-primary"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {showBatchActionsModal && (
        <div className="modal" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2100 }}>
          <div className="modal-content" style={{ maxWidth: '400px', margin: '100px auto', backgroundColor: '#fff', borderRadius: '8px', padding: '20px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #ddd', marginBottom: '15px' }}>
              <h5 style={{ color: '#555', margin: 0 }}>Batch Actions</h5>
            </div>
            <div className="modal-body">
              <p>Selected Batches: {selectedBatchIds.join(', ')}</p>
              <div className="d-flex gap-2">
                <button className="btn btn-success" onClick={handleCompleteBatches}>
                  Complete Selected
                </button>
                <button className="btn btn-danger" onClick={handleDeleteBatches}>
                  Delete Selected
                </button>
              </div>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #ddd', marginTop: '15px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowBatchActionsModal(false)}
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

export default Production;