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
                UNION
                {
                    ?entity a dbo:Star ;
                           rdfs:label ?label ;
                           dbo:abstract ?abstract .
                    BIND("star" AS ?type)
                    OPTIONAL { ?entity dbo:mass ?mass }
                    OPTIONAL { ?entity dbo:radius ?radius }
                    OPTIONAL { ?entity dbo:thumbnail ?img }
                }
                FILTER(LANG(?label) = 'en')
                FILTER(LANG(?abstract) = 'en')
                FILTER(${createFlexibleFilter('?label')})
            }
            GROUP BY ?entity ?label ?abstract ?type ?mass ?radius ?area ?stars
            ORDER BY ASC(STRLEN(?label))
            LIMIT 10
        `;
    } else {
        switch (searchType) {
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
                    LIMIT 10
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
                    LIMIT 10
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
                    LIMIT 10
                `;
                break;
            case 'star':
                query = `
                    SELECT DISTINCT ?entity ?label ?abstract ?mass ?radius ?thumbnail WHERE {
                        ?entity a dbo:Star ;
                               rdfs:label ?label ;
                               dbo:abstract ?abstract .
                        OPTIONAL { ?entity dbo:mass ?mass }
                        OPTIONAL { ?entity dbo:radius ?radius }
                        OPTIONAL { ?entity dbo:thumbnail ?thumbnail }
                        FILTER(LANG(?label) = 'en')
                        FILTER(LANG(?abstract) = 'en')
                        FILTER(${createFlexibleFilter('?label')})
                    }
                    ORDER BY ASC(STRLEN(?label))
                    LIMIT 10
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
            link = `planet_details.html?planetName=${planetName}`;
        } else if (type === 'galaxy') {
            const galaxyName = name.split(' ')[0]; // On prend le premier mot du nom (ex: "Mars" dans "Mars (planet)")
            link = `galaxy-details.html?galaxyName=${name}`;
        } else if (type === 'star') {
            link = `details-star.html?name=${encodeURIComponent(name)}`;
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
                    ` :
                (type === 'galaxy' || type === 'star' ? `
                        <a href="${link}" class="inline-block bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all duration-300">
                            View details
                        </a>
                    ` : '')}
                </div>
            </div>
        `;

        resultsDiv.appendChild(card);
    });
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
        <div id="modalImage" class="w-full flex justify-center mb-6">
            ${result.thumbnail?.value ?
            `<img src="${result.thumbnail.value}" alt="${label}" 
                     class="rounded-lg max-h-[300px] object-cover shadow-lg" />`
            : ''}
        </div>
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
document.getElementById('detailModal').addEventListener('click', function (e) {
    if (e.target === this) {
        closeModal();
    }
});

// Fermer le modal avec la touche Echap
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeModal();
    }
});

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
document.getElementById('searchInput').addEventListener('keypress', function (e) {
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
