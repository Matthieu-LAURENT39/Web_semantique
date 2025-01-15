const DBPEDIA_ENDPOINT = 'https://dbpedia.org/sparql';

// Fonction pour construire la requête SPARQL en fonction du type
function buildQuery(searchTerm, searchType) {
    const term = searchTerm.toLowerCase();
    let query = '';
    
    switch(searchType) {
        case 'planet':
            query = `
                SELECT DISTINCT ?planet ?label ?abstract ?mass ?radius WHERE {
                    ?planet a dbo:Planet ;
                           rdfs:label ?label ;
                           dbo:abstract ?abstract .
                    OPTIONAL { ?planet dbo:mass ?mass }
                    OPTIONAL { ?planet dbo:meanRadius ?radius }
                    FILTER(LANG(?label) = 'fr')
                    FILTER(LANG(?abstract) = 'fr')
                    FILTER(CONTAINS(LCASE(?label), "${term}"))
                }
                LIMIT 10
            `;
            break;
        case 'galaxy':
            query = `
                SELECT DISTINCT ?galaxy ?label ?abstract ?constellation WHERE {
                    ?galaxy a dbo:Galaxy ;
                           rdfs:label ?label ;
                           dbo:abstract ?abstract .
                    OPTIONAL { ?galaxy dbo:constellation ?constellation }
                    FILTER(LANG(?label) = 'fr')
                    FILTER(LANG(?abstract) = 'fr')
                    FILTER(CONTAINS(LCASE(?label), "${term}"))
                }
                LIMIT 10
            `;
            break;
        case 'universe':
            query = `
                SELECT DISTINCT ?concept ?label ?abstract WHERE {
                    ?concept a owl:Thing ;
                            rdfs:label ?label ;
                            dbo:abstract ?abstract .
                    FILTER(LANG(?label) = 'fr')
                    FILTER(LANG(?abstract) = 'fr')
                    FILTER(CONTAINS(LCASE(?label), "${term}"))
                    FILTER(CONTAINS(LCASE(?abstract), "univers"))
                }
                LIMIT 10
            `;
            break;
    }
    
    return encodeURIComponent(query);
}

// Fonction pour effectuer la recherche
async function search() {
    const searchInput = document.getElementById('searchInput');
    const searchType = document.getElementById('searchType');
    const resultsDiv = document.getElementById('results');
    
    if (!searchInput.value.trim()) {
        resultsDiv.innerHTML = '<p>Veuillez entrer un terme de recherche</p>';
        return;
    }
    
    resultsDiv.innerHTML = '<p>Recherche en cours...</p>';
    
    const query = buildQuery(searchInput.value.trim(), searchType.value);
    const url = `${DBPEDIA_ENDPOINT}?query=${query}&format=json`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json'
            }
        });
        
        if (!response.ok) throw new Error('Erreur réseau');
        
        const data = await response.json();
        displayResults(data.results.bindings, searchType.value);
    } catch (error) {
        resultsDiv.innerHTML = `<p>Erreur lors de la recherche: ${error.message}</p>`;
    }
}

// Fonction pour afficher les résultats
function displayResults(results, searchType) {
    const resultsDiv = document.getElementById('results');
    
    if (!results || results.length === 0) {
        resultsDiv.innerHTML = '<p>Aucun résultat trouvé</p>';
        return;
    }
    
    let html = '';
    results.forEach(result => {
        const label = result.label?.value || 'Sans nom';
        const abstract = result.abstract?.value || 'Pas de description disponible';
        
        html += `
            <div class="result-item">
                <h2>${label}</h2>
                <p>${abstract}</p>
        `;
        
        // Ajouter des informations spécifiques selon le type
        if (searchType === 'planet' && result.mass) {
            html += `<p><strong>Masse:</strong> ${result.mass.value}</p>`;
        }
        if (searchType === 'planet' && result.radius) {
            html += `<p><strong>Rayon moyen:</strong> ${result.radius.value}</p>`;
        }
        if (searchType === 'galaxy' && result.constellation) {
            html += `<p><strong>Constellation:</strong> ${result.constellation.value}</p>`;
        }
        
        html += '</div>';
    });
    
    resultsDiv.innerHTML = html;
}

// Permettre la recherche avec la touche Entrée
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        search();
    }
}); 