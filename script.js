const DBPEDIA_ENDPOINT = 'https://dbpedia.org/sparql';

// Fonction pour nettoyer le texte
function cleanText(text) {
    return text.replace(/\(.*?\)/g, '').trim();
}

// Fonction pour calculer la distance de Levenshtein
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // Initialiser la matrice
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Remplir la matrice
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

// Fonction pour construire la requête SPARQL en fonction du type
function buildQuery(searchTerm, searchType) {
    const term = searchTerm.toLowerCase();
    
    // Fonction helper pour créer un filtre de recherche plus flexible
    const createFlexibleFilter = (variable) => {
        return `(CONTAINS(LCASE(${variable}), "${term}"))`;
    };
    
    if (searchType === 'all') {
        query = `
            SELECT DISTINCT ?entity ?label ?abstract ?type ?mass ?radius ?area ?stars (SAMPLE(?img) as ?thumbnail) WHERE {
                {
                    ?entity a dbo:Planet ;
                           rdfs:label ?label ;
                           dbo:abstract ?abstract .
                    BIND("planet" AS ?type)
                    OPTIONAL { ?entity dbo:mass ?mass }
                    OPTIONAL { ?entity dbo:meanRadius ?radius }
                    OPTIONAL { 
                        {
                            ?entity foaf:depiction ?img
                        } UNION {
                            ?entity dbp:image ?img
                        }
                    }
                }
                UNION
                {
                    ?entity a dbo:Galaxy ;
                           rdfs:label ?label ;
                           dbo:abstract ?abstract .
                    BIND("galaxy" AS ?type)
                    OPTIONAL { ?entity dbo:thumbnail ?img }
                }
                UNION
                {
                    ?entity a dbo:Constellation ;
                           rdfs:label ?label ;
                           dbo:abstract ?abstract .
                    BIND("constellation" AS ?type)
                    OPTIONAL { ?entity dbo:area ?area }
                    OPTIONAL { ?entity dbp:stars ?stars }
                    OPTIONAL { ?entity dbo:thumbnail ?img }
                }
                FILTER(LANG(?label) = 'en')
                FILTER(LANG(?abstract) = 'en')
                FILTER(${createFlexibleFilter('?label')})
            }
            GROUP BY ?entity ?label ?abstract ?type ?mass ?radius ?area ?stars
            ORDER BY ASC(STRLEN(?label))
            LIMIT 30
        `;
    } else {
        switch(searchType) {
            case 'planet':
                query = `
                    SELECT DISTINCT ?entity ?label ?abstract ?mass ?radius (SAMPLE(?img) as ?thumbnail) WHERE {
                        ?entity a dbo:Planet ;
                               rdfs:label ?label ;
                               dbo:abstract ?abstract .
                        OPTIONAL { ?entity dbo:mass ?mass }
                        OPTIONAL { ?entity dbo:meanRadius ?radius }
                        OPTIONAL { 
                            {
                                ?entity foaf:depiction ?img
                            } UNION {
                                ?entity dbp:image ?img
                            }
                        }
                        FILTER(LANG(?label) = 'en')
                        FILTER(LANG(?abstract) = 'en')
                        FILTER(${createFlexibleFilter('?label')})
                    }
                    GROUP BY ?entity ?label ?abstract ?mass ?radius
                    LIMIT 15
                `;
                break;
            case 'galaxy':
                query = `
                    SELECT DISTINCT ?entity ?label ?abstract ?thumbnail WHERE {
                        ?entity a dbo:Galaxy ;
                               rdfs:label ?label ;
                               dbo:abstract ?abstract .
                        OPTIONAL { ?entity dbo:thumbnail ?thumbnail }
                        FILTER(LANG(?label) = 'en')
                        FILTER(LANG(?abstract) = 'en')
                        FILTER(${createFlexibleFilter('?label')})
                    }
                    LIMIT 15
                `;
                break;
            case 'constellation':
                query = `
                    SELECT DISTINCT ?entity ?label ?abstract ?area ?stars ?thumbnail WHERE {
                        ?entity a dbo:Constellation ;
                               rdfs:label ?label ;
                               dbo:abstract ?abstract .
                        OPTIONAL { ?entity dbo:area ?area }
                        OPTIONAL { ?entity dbp:stars ?stars }
                        OPTIONAL { ?entity dbo:thumbnail ?thumbnail }
                        FILTER(LANG(?label) = 'en')
                        FILTER(LANG(?abstract) = 'en')
                        FILTER(${createFlexibleFilter('?label')})
                    }
                    ORDER BY ASC(STRLEN(?label))
                    LIMIT 15
                `;
                break;
        }
    }
    
    return encodeURIComponent(query);
}

// Fonction pour calculer le score de pertinence
function calculateRelevanceScore(searchTerm, label, abstract = '') {
    const cleanSearchTerm = cleanText(searchTerm.toLowerCase());
    const cleanLabel = cleanText(label.toLowerCase());
    const cleanAbstract = cleanText(abstract.toLowerCase());
    
    // Distance de Levenshtein normalisée (0 à 1, où 1 est une correspondance parfaite)
    const maxLength = Math.max(cleanSearchTerm.length, cleanLabel.length);
    const levenScore = 1 - (levenshteinDistance(cleanSearchTerm, cleanLabel) / maxLength);
    
    // Bonus pour les correspondances exactes
    const exactMatchBonus = cleanLabel.includes(cleanSearchTerm) ? 0.3 : 0;
    
    // Bonus pour les correspondances au début
    const startsWithBonus = cleanLabel.startsWith(cleanSearchTerm) ? 0.2 : 0;
    
    // Bonus pour les correspondances dans la description
    const abstractBonus = cleanAbstract.includes(cleanSearchTerm) ? 0.1 : 0;
    
    return levenScore + exactMatchBonus + startsWithBonus + abstractBonus;
}

// Fonction pour trier les résultats par pertinence
function sortResultsByRelevance(results, searchTerm) {
    return results.sort((a, b) => {
        const scoreA = calculateRelevanceScore(searchTerm, a.label.value, a.abstract?.value);
        const scoreB = calculateRelevanceScore(searchTerm, b.label.value, b.abstract?.value);
        return scoreB - scoreA; // Tri décroissant
    });
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
        const sortedResults = sortResultsByRelevance(data.results.bindings, searchInput.value.trim());
        displayResults(sortedResults, searchType.value);
    } catch (error) {
        resultsDiv.innerHTML = `<p>Erreur lors de la recherche: ${error.message}</p>`;
    }
}

// Fonction pour afficher les résultats
function displayResults(results, searchType) {
    const resultsDiv = document.getElementById('results');
    
    if (!results || results.length === 0) {
        resultsDiv.innerHTML = `
            <div class="glass rounded-xl p-6 text-center">
                <p class="text-gray-400">No results found</p>
            </div>`;
        return;
    }
    
    resultsDiv.innerHTML = '';
    results.forEach(result => {
        const card = document.createElement('div');
        card.className = 'glass rounded-xl p-6 hover:bg-white/5 transition-all duration-300';
        
        const type = result.type?.value || searchType;
        const name = result.label?.value || 'Unnamed';
        const abstract = result.abstract?.value || 'No description available';
        const image = result.thumbnail?.value || null;
        
        let link = '#';
        if (type === 'planet') {
            const planetName = name.split(' ')[0]; // On prend le premier mot du nom (ex: "Mars" dans "Mars (planet)")
            link = `planet.html?planetName=${planetName}`;
        }
        
        card.innerHTML = `
            <div class="flex flex-col md:flex-row gap-6">
                ${image ? `
                    <div class="md:w-1/3 flex-shrink-0">
                        <img src="${image}" alt="${name}" class="w-full h-48 object-cover rounded-lg">
                    </div>
                ` : ''}
                <div class="flex-1">
                    <div class="flex items-center gap-4 mb-4">
                        <h3 class="text-xl font-bold">${name}</h3>
                        <span class="result-type px-2 py-1 rounded-full text-xs font-medium">${type}</span>
                    </div>
                    <p class="text-gray-300 mb-4">${abstract.substring(0, 200)}...</p>
                    ${type === 'planet' ? `
                        <a href="${link}" class="inline-block bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all duration-300">
                            View details
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
        
        resultsDiv.appendChild(card);
    });
}

// Fonction pour récupérer les constellations associées à un trou noir
async function getBlackHoleConstellations(blackHoleUri) {
    const query = `
        SELECT DISTINCT ?constellation ?label WHERE {
            <${blackHoleUri}> dbp:constell ?constellation .
            ?constellation rdfs:label ?label .
            FILTER(LANG(?label) = 'en')
        }
    `;
    
    const url = `${DBPEDIA_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json'
            }
        });
        
        if (!response.ok) throw new Error('Network error');
        
        const data = await response.json();
        return data.results.bindings;
    } catch (error) {
        console.error('Error fetching constellations:', error);
        return [];
    }
}

// Fonction pour afficher les détails
function showDetails(index, result, type) {
    if (type === 'blackhole') {
        // Redirection directe vers la page de détails de la constellation
        const constellationName = result.constell?.value || result.label?.value;
        if (constellationName) {
            window.location.href = `constellation-details.html?name=${encodeURIComponent(constellationName)}`;
        }
    } else {
        const label = cleanText(result.label?.value || 'Sans nom');
        window.location.href = `${type}-details.html?name=${encodeURIComponent(label)}`;
    }
}

// Fonction pour obtenir le label du type en anglais
function getTypeLabel(type) {
    const types = {
        'planet': 'Planet',
        'galaxy': 'Galaxy',
        'constellation': 'Constellation'
    };
    return types[type] || type;
}

// Permettre la recherche avec la touche Entrée
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        search();
    }
});

// Fonction pour formater les valeurs numériques
function formatValue(value) {
    if (!value) return 'Not available';
    
    // Si c'est un nombre scientifique
    if (value.includes('E')) {
        const [num, exp] = value.split('E');
        return `${parseFloat(num).toFixed(2)} × 10<sup>${exp}</sup>`;
    }
    
    return value;
}

// Fonction pour créer une carte de constellation
function createConstellationCard(constellation) {
    const card = document.createElement('div');
    card.className = 'glass rounded-xl overflow-hidden transform transition-all duration-300 hover:scale-[1.02] cursor-pointer mb-6';
    card.onclick = () => window.location.href = `constellation.html?name=${encodeURIComponent(constellation.name)}`;

    // Créer le contenu de la carte
    const imageStyle = constellation.image ? 
        `background-image: url('${constellation.image}'); height: 200px;` : 
        'height: 0;';

    card.innerHTML = `
        <div class="bg-cover bg-center" style="${imageStyle}"></div>
        <div class="p-6">
            <h2 class="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                ${constellation.name}
            </h2>
            <div class="flex flex-wrap gap-2 mb-4">
                ${constellation.stars ? `
                    <div class="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm">
                        ${constellation.stars} stars
                    </div>
                ` : ''}
                ${constellation.area ? `
                    <div class="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-sm">
                        ${parseFloat(constellation.area).toFixed(2)} sq deg
                    </div>
                ` : ''}
            </div>
            <p class="text-gray-300 line-clamp-3">
                ${constellation.abstract}
            </p>
        </div>
    `;

    return card;
} 
