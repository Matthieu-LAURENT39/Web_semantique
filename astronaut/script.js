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
 SELECT DISTINCT ?entity ?label ?abstract ?nationality ?birthplace SAMPLE(?thumbnail) as ?img ?type WHERE { 
                {
                    ?entity dbp:occupation dbr:Astronaut;
                        rdf:type dbo:Person;
                        rdfs:label ?label;
                        dbo:birthPlace ?birthplace;
                        foaf:depiction ?thumbnail;
                        dbo:nationality ?nationality;
                        dbo:abstract ?abstract .
                    BIND("astronaut" AS ?type)
                }
                UNION
                {
                    ?entity rdf:type dbo:SpaceMission;
                        rdfs:label ?label;
                        dbo:abstract ?abstract .
                    BIND("mission" AS ?type)
                }
                FILTER(LANG(?label) = 'en')
                FILTER(LANG(?abstract) = 'en')
                FILTER(${createFlexibleFilter('?label')})
            }
            ORDER BY ASC(STRLEN(?label))    
            LIMIT 30
        `;
    } else {
        switch(searchType) {
            case 'astronaut':
//                 query = `
//  SELECT DISTINCT ?astronaut ?label ?abstract ?nationality ?brithplace SAMPLE(?thumbnail) as ?img WHERE {
//                     ?astronaut dbp:occupation dbr:Astronaut;
//                     rdf:type dbo:Person;
//                     rdfs:label ?label;
//                     dbo:birthPlace ?birthplace;
//                     foaf:depiction ?thumbnail;
//                     dbo:nationality ?nationalityR;
//                     dbo:abstract ?abstract .
//                     ?nationalityR rdfs:label ?nationality.
//                     FILTER(LANG(?label) = 'en')
//                     FILTER(LANG(?abstract) = 'en')
//                     FILTER(LANG(?nationality) = 'en')
//                     FILTER(${createFlexibleFilter('?label')})
//                     }
//                     LIMIT 15`
   
//                 ;
                query = `SELECT DISTINCT ?astronaut ?label ?abstract ?nationality SAMPLE(?birthplace) AS ?birthplace 
                SAMPLE(?thumbnail) AS ?img ?birthDate 
                SAMPLE(?status) AS ?status SAMPLE(?type) AS ?type 
                (GROUP_CONCAT(?mission; separator=", ") AS ?missions)
WHERE {
    ?astronaut dbp:occupation dbr:Astronaut;
               rdf:type dbo:Person;
               rdfs:label ?label;
               foaf:depiction ?thumbnail;
               dbo:nationality ?nationalityR;
               dbo:abstract ?abstract.
    OPTIONAL { ?astronaut dbo:birthPlace ?birthplaceR. }
    OPTIONAL { ?astronaut dbo:birthDate ?birthDate. }
    OPTIONAL { ?astronaut dbp:status ?status. }
    OPTIONAL { ?astronaut dbp:type ?type. }
    OPTIONAL { ?astronaut dbo:mission ?mission. }
    OPTIONAL { ?birthplaceR rdfs:label ?birthplace. }
    ?nationalityR rdfs:label ?nationality.
    FILTER(LANG(?label) = 'en')
    FILTER(LANG(?abstract) = 'en')
    FILTER(LANG(?nationality) = 'en')
    FILTER(${createFlexibleFilter('?label')})
}
GROUP BY ?astronaut ?label ?abstract ?nationality ?birthDate
LIMIT 15`
                break;
            case 'mission':
                query = `
    SELECT ?mission ?label ?abstract WHERE {
                    ?mission rdf:type dbo:SpaceMission;
                    rdfs:label ?label;
                    dbo:abstract ?abstract .
                    FILTER(LANG(?label) = 'en')
                    FILTER(LANG(?abstract) = 'en')
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
        console.log(result)
        const label = cleanText(result.label?.value || 'Unknown');
        const type = result.type?.value || searchType;
        const nationality = result.nationality?.value || 'Unknown';
        const img = result.img?.value || 'default-astronaut.svg'; // Image par défaut si aucune image disponible

        html += `
        <div class="glass rounded-xl p-2 transform transition-all duration-300 hover:scale-[1.02] cursor-pointer" 
             onclick="showDetails(${index}, ${JSON.stringify(result).replace(/"/g, '&quot;')}, '${type}')">
            <div class="flex items-center gap-4">
                <img src="${img}" alt="${label}" class="w-24 h-24 object-cover rounded-lg">

                <div>
                    <h2 class="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                        ${label}
                    </h2>
                    <p class="text-gray-400 text-sm">Nationality : ${nationality}</p>
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

// Fonction pour afficher les détails dans le modal
function showDetails(index, result, type) {
    const modal = document.getElementById('detailModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');

    const label = result.label?.value || 'No name';
    const abstract = result.abstract?.value || 'No description available';
    const nationality = result.nationality?.value || 'Unknown';
    const img = result.img?.value || 'default-astronaut.svg';
    const birthPlace = result.birthplace?.value || 'Unknown';
    const birthDate = result.birthDate?.value || 'Unknown';
    const status = result.status?.value || 'Unknown';
    const astronautType = result.type?.value || 'Unknown';
    const missions = result.missions?.value || 'None';

    modalTitle.textContent = label;
    modalContent.innerHTML = `
        <div class="flex gap-4">
            <img src="${img}" alt="${label}" class="w-32 h-32 object-cover rounded-lg">
            <div>
                <p><strong>Description :</strong> ${abstract}</p>
                <p><strong>Nationality :</strong> ${nationality}</p>
                <p><strong>Birthplace :</strong> ${birthPlace}</p>
                <p><strong>Birthdate :</strong> ${birthDate}</p>
                <p><strong>Status :</strong> ${status}</p>
                <p><strong>Type :</strong> ${astronautType}</p>
                <p><strong>Missions :</strong> ${missions}</p>
            </div>
        </div>
    `;

    modal.classList.add('active');
}


// function showDetails(index, result, type) {
//     const modal = document.getElementById('detailModal');
//     const modalTitle = document.getElementById('modalTitle');
//     const modalContent = document.getElementById('modalContent');

//     const label = result.label?.value || 'No name';
//     const abstract = result.abstract?.value || 'No description available';
//     const nationality = result.nationality?.value || 'Unknown';
//     const img = result.img?.value
//     const birthPlace = result.birthplace?.value || 'Unknown';

//     modalTitle.textContent = label;
//     modalContent.innerHTML = `
//         <div class="flex gap-4">
//          <img src="${img}" alt="${label}" class="w-32 h-32 object-cover rounded-lg">
//             <div>
//                 <p><strong>Description :</strong> ${abstract}</p>
//                 <p><strong>Nationality :</strong> ${nationality}</p>
//                 <p><strong>Birthplace:</strong> ${birthPlace}</p>
//             </div>
//         </div>
//     `;

//     modal.classList.add('active');
// }


// Fonction pour fermer le modal
function closeModal() {
    const modal = document.getElementById('detailModal');
    const modalContent = modal.querySelector('.modal-content');
    
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
