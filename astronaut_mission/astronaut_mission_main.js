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

// Fonction pour construire la requête SPARQL en fonction du type de recherche (barre de recherche globale)
function buildQuery(searchTerm, searchType) {
    const term = searchTerm.toLowerCase();
    
    // Fonction helper pour créer un filtre de recherche plus flexible
    const createFlexibleFilter = (variable) => {
        return `(CONTAINS(LCASE(${variable}), "${term}"))`;
    };
    
    if (searchType === 'all') {
        query = `
 SELECT DISTINCT ?entity ?label SAMPLE(?thumbnail) as ?img ?type WHERE { 
                {
                    ?entity dbp:occupation dbr:Astronaut;
                        rdf:type dbo:Person;
                        rdfs:label ?label;
                        foaf:depiction ?thumbnail.
                    BIND("astronaut" AS ?type)
                }
                UNION
                {
                    ?entity rdf:type dbo:SpaceMission;
                        rdfs:label ?label.
                    BIND("mission" AS ?type)
                }
                FILTER(LANG(?label) = 'en')
                FILTER(${createFlexibleFilter('?label')})
            }   
            LIMIT 30
        `;
    } else {
        switch(searchType) {
            case 'astronaut':
                query=
                `SELECT DISTINCT ?entity ?label SAMPLE(?thumbnail) AS ?img WHERE {
                    ?entity dbp:occupation dbr:Astronaut;
                            rdf:type dbo:Person;
                            rdfs:label ?label;
                            foaf:depiction ?thumbnail.
                    FILTER(LANG(?label) = 'en')
                    FILTER(${createFlexibleFilter('?label')})
                }
                LIMIT 15
`               ;
                break;
            case 'mission':
                query = 
                `SELECT DISTINCT ?entity ?label ?abstract WHERE {
                    ?entity rdf:type dbo:SpaceMission;
                    rdfs:label ?label.
                    FILTER(LANG(?label) = 'en')
                    FILTER(${createFlexibleFilter('?label')})
                    }
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
        resultsDiv.innerHTML = '<p>Please enter search term</p>';
        return;
    }
    
    resultsDiv.innerHTML = '<p>Searching...</p>';
    
    const query = buildQuery(searchInput.value.trim(), searchType.value);
    const url = `${DBPEDIA_ENDPOINT}?query=${query}&format=json`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json'
            }
        });
        
        if (!response.ok) throw new Error('Network error');
        
        const data = await response.json();
        const sortedResults = sortResultsByRelevance(data.results.bindings, searchInput.value.trim());
        displayResults(sortedResults, searchType.value);
    } catch (error) {
        console.log(error)
        resultsDiv.innerHTML = `<p>Error when searching: ${error.message}</p>`;
    }
}

// Fonction pour afficher les résultats
function displayResults(results, searchType) {
    const resultsDiv = document.getElementById('results');

    if (!results || results.length === 0) {
        resultsDiv.innerHTML = `
            <div class="glass rounded-xl p-6 text-center">
                <p class="text-gray-400">No result found</p>
            </div>`;
        return;
    }

    let html = '';
    results.forEach((result, index) => {
        
        const label = cleanText(result.label?.value || 'Unknown');
        const type = result.type?.value || searchType;
        // Image par défaut si aucune image disponible
        let img = null;
        if (type == "astronaut"){
            img = result.img?.value || 'default-astronaut.svg'; 
        } else {
            img = result.img?.value || 'default-mission.svg';
        }
        
        const entityURI = result.entity.value;

        html += `
        <div class="glass rounded-xl p-2 transform transition-all duration-300 hover:scale-[1.02] cursor-pointer" 
             onclick="loadDetails('${entityURI}', '${type}')">
            <div class="flex items-center gap-4">
                <img src="${img}" alt="${label}" class="w-24 h-24 object-cover rounded-lg">

                <div>
                    <h2 class="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                        ${label}
                    </h2>
                    ${searchType === 'all' ? `
                        <span class="result-type px-3 py-1 rounded-full text-sm font-medium text-cyan-400">
                            ${getTypeLabel(type)}
                        </span>
                    ` : ''}
                </div>
            </div>
        </div>`;
    });

    resultsDiv.innerHTML = html;
}

// Fonction pour fetch les détails d'une entité
function loadDetails(entityURI, type) {
    const baseUrl = type === "astronaut" ? "astronaut_detail.html" : "mission_detail.html";   
    const url = `${baseUrl}?uri=${encodeURIComponent(entityURI)}`; 
    if (type == "astronaut"){
        window.location.href = url;
    }
    else {
        console.log("todo")
    }
}


// Fonction pour obtenir le label du type
function getTypeLabel(type) {
    const types = {
        'astronaut': 'Astronaut',
        'mission': 'Mission',
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
