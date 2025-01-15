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
            SELECT DISTINCT ?entity ?label ?abstract ?type ?mass ?radius ?area ?stars WHERE {
                {
                    ?entity a dbo:Planet ;
                           rdfs:label ?label ;
                           dbo:abstract ?abstract .
                    BIND("planet" AS ?type)
                    OPTIONAL { ?entity dbo:mass ?mass }
                    OPTIONAL { ?entity dbo:meanRadius ?radius }
                }
                UNION
                {
                    ?entity a dbo:Galaxy ;
                           rdfs:label ?label ;
                           dbo:abstract ?abstract .
                    BIND("galaxy" AS ?type)
                }
                UNION
                {
                    ?entity a dbo:Constellation ;
                           rdfs:label ?label ;
                           dbo:abstract ?abstract .
                    BIND("constellation" AS ?type)
                    OPTIONAL { ?entity dbo:area ?area }
                    OPTIONAL { ?entity dbp:stars ?stars }
                }
                FILTER(LANG(?label) = 'fr')
                FILTER(LANG(?abstract) = 'fr')
                FILTER(${createFlexibleFilter('?label')})
            }
            ORDER BY ASC(STRLEN(?label))
            LIMIT 30
        `;
    } else {
        switch(searchType) {
            case 'planet':
                query = `
                    SELECT DISTINCT ?entity ?label ?abstract ?mass ?radius WHERE {
                        ?entity a dbo:Planet ;
                               rdfs:label ?label ;
                               dbo:abstract ?abstract .
                        OPTIONAL { ?entity dbo:mass ?mass }
                        OPTIONAL { ?entity dbo:meanRadius ?radius }
                        FILTER(LANG(?label) = 'fr')
                        FILTER(LANG(?abstract) = 'fr')
                        FILTER(${createFlexibleFilter('?label')})
                    }
                    LIMIT 15
                `;
                break;
            case 'galaxy':
                query = `
                    SELECT DISTINCT ?entity ?label ?abstract WHERE {
                        ?entity a dbo:Galaxy ;
                               rdfs:label ?label ;
                               dbo:abstract ?abstract .
                        FILTER(LANG(?label) = 'fr')
                        FILTER(LANG(?abstract) = 'fr')
                        FILTER(${createFlexibleFilter('?label')})
                    }
                    LIMIT 15
                `;
                break;
            case 'constellation':
                query = `
                    SELECT DISTINCT ?entity ?label ?abstract ?area ?stars WHERE {
                        ?entity a dbo:Constellation ;
                               rdfs:label ?label ;
                               dbo:abstract ?abstract .
                        OPTIONAL { ?entity dbo:area ?area }
                        OPTIONAL { ?entity dbp:stars ?stars }
                        FILTER(LANG(?label) = 'fr')
                        FILTER(LANG(?abstract) = 'fr')
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
                <p class="text-gray-400">Aucun résultat trouvé</p>
            </div>`;
        return;
    }
    
    let html = '';
    results.forEach((result, index) => {
        const label = cleanText(result.label?.value || 'Sans nom');
        const abstract = result.abstract?.value || 'Pas de description disponible';
        const type = result.type?.value || searchType;
        
        html += `
            <div class="glass rounded-xl p-6 transform transition-all duration-300 hover:scale-[1.02] cursor-pointer" 
                 onclick="showDetails(${index}, ${JSON.stringify(result).replace(/"/g, '&quot;')}, '${type}')">
                <div class="flex flex-col gap-3">
                    <div class="flex items-start justify-between">
                        <h2 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                            ${label}
                        </h2>
                        ${searchType === 'all' ? `
                            <span class="result-type px-3 py-1 rounded-full text-sm font-medium text-cyan-400">
                                ${getTypeLabel(type)}
                            </span>
                        ` : ''}
                    </div>
                    
                    <p class="text-gray-300 leading-relaxed line-clamp-3">
                        ${abstract}
                    </p>
                </div>
            </div>`;
    });
    
    resultsDiv.innerHTML = html;
}

// Fonction pour afficher les détails dans le modal
function showDetails(index, result, type) {
    const modal = document.getElementById('detailModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    
    const label = cleanText(result.label?.value || 'Sans nom');
    const abstract = result.abstract?.value || 'Pas de description disponible';
    
    modalTitle.textContent = label;
    
    let content = `
        <div class="space-y-6">
            <div class="info-card">
                <p class="text-gray-300 leading-relaxed text-lg">
                    ${abstract}
                </p>
            </div>
    `;

    // Section pour les informations techniques
    let hasDetails = false;
    let detailsContent = '';

    if ((type === 'planet' || type === 'planet') && result.mass) {
        hasDetails = true;
        detailsContent += `
            <div class="info-card">
                <h3 class="text-cyan-400 font-medium text-lg mb-2">Masse</h3>
                <p class="text-gray-300">${formatValue(result.mass.value)}</p>
            </div>`;
    }
    if ((type === 'planet' || type === 'planet') && result.radius) {
        hasDetails = true;
        detailsContent += `
            <div class="info-card">
                <h3 class="text-cyan-400 font-medium text-lg mb-2">Rayon moyen</h3>
                <p class="text-gray-300">${formatValue(result.radius.value)}</p>
            </div>`;
    }
    if ((type === 'constellation' || type === 'constellation')) {
        if (result.area) {
            hasDetails = true;
            detailsContent += `
                <div class="info-card">
                    <h3 class="text-cyan-400 font-medium text-lg mb-2">Surface</h3>
                    <p class="text-gray-300">${result.area.value} degrés carrés</p>
                </div>`;
        }
        if (result.stars) {
            hasDetails = true;
            detailsContent += `
                <div class="info-card">
                    <h3 class="text-cyan-400 font-medium text-lg mb-2">Étoiles principales</h3>
                    <p class="text-gray-300">${result.stars.value}</p>
                </div>`;
        }
    }

    if (hasDetails) {
        content += `
            <div>
                <h3 class="text-xl font-semibold mb-4 text-cyan-400">Caractéristiques</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${detailsContent}
                </div>
            </div>
        `;
    }
    
    content += `
            <div class="info-card mt-6">
                <p class="text-sm text-gray-400">
                    Source: DBpedia
                    <br>
                    Type: ${getTypeLabel(type)}
                </p>
            </div>
        </div>
    `;
    
    modalContent.innerHTML = content;
    modal.classList.add('active');

    setTimeout(() => {
        modal.querySelector('.modal-content').style.opacity = '1';
        modal.querySelector('.modal-content').style.transform = 'scale(1)';
    }, 10);
}

// Fonction pour fermer le modal
function closeModal() {
    const modal = document.getElementById('detailModal');
    const modalContent = modal.querySelector('.modal-content');
    
    modalContent.style.opacity = '0';
    modalContent.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
        modal.classList.remove('active');
    }, 300);
}

// Fermer le modal en cliquant en dehors
document.getElementById('detailModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

// Fermer le modal avec la touche Echap
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// Fonction pour obtenir le label du type en français
function getTypeLabel(type) {
    const types = {
        'planet': 'Planète',
        'galaxy': 'Galaxie',
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
    if (!value) return 'Non disponible';
    
    // Si c'est un nombre scientifique
    if (value.includes('E')) {
        const [num, exp] = value.split('E');
        return `${parseFloat(num).toFixed(2)} × 10<sup>${exp}</sup>`;
    }
    
    return value;
} 
