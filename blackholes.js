const DBPEDIA_ENDPOINT = 'https://dbpedia.org/sparql';

// Function to clean text
function cleanText(text) {
    return text.replace(/\(.*?\)/g, '').trim();
}

// Function to toggle filters visibility
function toggleFilters() {
    const filterSection = document.getElementById('filterSection');
    const isHidden = filterSection.classList.contains('hidden');
    
    if (isHidden) {
        filterSection.classList.remove('hidden');
        loadFilterOptions();
    } else {
        filterSection.classList.add('hidden');
    }
}

// Function to load filter options
async function loadFilterOptions() {
    const query = encodeURIComponent(`
        PREFIX dbo: <http://dbpedia.org/ontology/>
        PREFIX dbr: <http://dbpedia.org/resource/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX dct: <http://purl.org/dc/terms/>
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        PREFIX dbp: <http://dbpedia.org/property/>
        
        SELECT DISTINCT ?constell ?class WHERE {
            ?blackhole a dbo:CelestialBody .
            {
                ?blackhole dct:subject/skos:broader* dbr:Category:Black_holes .
            } UNION {
                ?blackhole dbo:type dbr:Black_hole .
            }
            OPTIONAL { ?blackhole dbp:class ?class }
            OPTIONAL { ?blackhole dbp:constell ?constell }
        }
    `);
    
    try {
        const response = await fetch(
            `${DBPEDIA_ENDPOINT}?query=${query}&format=json`,
            { headers: { 'Accept': 'application/sparql-results+json' } }
        );
        
        if (!response.ok) throw new Error('Connection error');
        
        const data = await response.json();
        populateFilterOptions(data.results.bindings);
    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

// Function to populate filter options
function populateFilterOptions(results) {
    const constellations = new Set();
    const classes = new Set();
    
    results.forEach(result => {
        if (result.constell) constellations.add(formatPropertyValue(result.constell));
        if (result.class) classes.add(formatPropertyValue(result.class));
    });
    
    populateSelect('constellFilter', Array.from(constellations).sort());
    populateSelect('classFilter', Array.from(classes).sort());
}

// Function to populate a select element
function populateSelect(elementId, options) {
    const select = document.getElementById(elementId);
    const currentValue = select.value;
    
    // Keep the first "Any" option
    select.innerHTML = '<option value="">Any ' + select.previousElementSibling.textContent + '</option>';
    
    options.forEach(option => {
        const optElement = document.createElement('option');
        optElement.value = option;
        optElement.textContent = option;
        select.appendChild(optElement);
    });
    
    // Restore previous value if it exists
    if (currentValue && options.includes(currentValue)) {
        select.value = currentValue;
    }
}

// Function to get current filter values
function getFilterValues() {
    return {
        constell: document.getElementById('constellFilter').value,
        class: document.getElementById('classFilter').value
    };
}

// Function to build filter conditions
function buildFilterConditions(filters) {
    const conditions = [];
    
    if (filters.constell) {
        conditions.push(`CONTAINS(STR(?constell), "${filters.constell}")`);
    }
    if (filters.class) {
        conditions.push(`CONTAINS(STR(?class), "${filters.class}")`);
    }
    
    return conditions.length > 0 ? conditions.join(' && ') : null;
}

// Function to load black holes
async function loadBlackHoles() {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<p class="text-gray-400 text-center">Loading black holes...</p>';
    
    const filters = getFilterValues();
    const filterConditions = buildFilterConditions(filters);
    
    const query = encodeURIComponent(`
        PREFIX dbo: <http://dbpedia.org/ontology/>
        PREFIX dbr: <http://dbpedia.org/resource/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX dct: <http://purl.org/dc/terms/>
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        PREFIX dbp: <http://dbpedia.org/property/>
        
        SELECT DISTINCT ?blackhole ?label ?abstract ?class ?constell ?epoch ?rotationalVelocity WHERE {
            ?blackhole a dbo:CelestialBody ;
                      rdfs:label ?label ;
                      dbo:abstract ?abstract .
            {
                ?blackhole dct:subject/skos:broader* dbr:Category:Black_holes .
            } UNION {
                ?blackhole dbo:type dbr:Black_hole .
            }
            OPTIONAL { ?blackhole dbp:class ?class }
            OPTIONAL { ?blackhole dbp:constell ?constell }
            OPTIONAL { ?blackhole dbp:epoch ?epoch }
            OPTIONAL { ?blackhole dbp:rotationalVelocity ?rotationalVelocity }
            
            FILTER(LANG(?label) = 'en')
            FILTER(LANG(?abstract) = 'en')
            ${filterConditions ? `FILTER(${filterConditions})` : ''}
        }
        ORDER BY DESC(CONTAINS(LCASE(?abstract), "black hole"))
        LIMIT 10
    `);
    
    try {
        const response = await fetch(
            `${DBPEDIA_ENDPOINT}?query=${query}&format=json`,
            { headers: { 'Accept': 'application/sparql-results+json' } }
        );
        
        if (!response.ok) throw new Error('Connection error');
        
        const data = await response.json();
        displayResults(data.results.bindings);
    } catch (error) {
        console.error('Error:', error);
        resultsDiv.innerHTML = '<p class="text-red-500 text-center">Error loading data</p>';
    }
}

// Function to perform search
async function search() {
    const searchInput = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('results');
    const term = searchInput.value.trim().toLowerCase();
    const filters = getFilterValues();
    const filterConditions = buildFilterConditions(filters);
    
    if (!term && !filterConditions) {
        resultsDiv.innerHTML = '<p class="text-gray-400 text-center">Please enter a search term or select filters</p>';
        return;
    }
    
    resultsDiv.innerHTML = '<p class="text-gray-400 text-center">Searching...</p>';
    
    const query = encodeURIComponent(`
        PREFIX dbo: <http://dbpedia.org/ontology/>
        PREFIX dbr: <http://dbpedia.org/resource/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX dct: <http://purl.org/dc/terms/>
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        PREFIX dbp: <http://dbpedia.org/property/>
        
        SELECT DISTINCT ?blackhole ?label ?abstract ?class ?constell ?epoch ?rotationalVelocity WHERE {
            ?blackhole a dbo:CelestialBody ;
                      rdfs:label ?label ;
                      dbo:abstract ?abstract .
            {
                ?blackhole dct:subject/skos:broader* dbr:Category:Black_holes .
            } UNION {
                ?blackhole dbo:type dbr:Black_hole .
            }
            OPTIONAL { ?blackhole dbp:class ?class }
            OPTIONAL { ?blackhole dbp:constell ?constell }
            OPTIONAL { ?blackhole dbp:epoch ?epoch }
            OPTIONAL { ?blackhole dbp:rotationalVelocity ?rotationalVelocity }
            
            FILTER(LANG(?label) = 'en')
            FILTER(LANG(?abstract) = 'en')
            ${term ? `FILTER(
                CONTAINS(LCASE(?label), "${term}") || 
                CONTAINS(LCASE(?abstract), "${term}") ||
                CONTAINS(LCASE(?label), "black hole") ||
                CONTAINS(LCASE(?abstract), "black hole")
            )` : ''}
            ${filterConditions ? `FILTER(${filterConditions})` : ''}
        }
        ORDER BY DESC(
            ${term ? `IF(CONTAINS(LCASE(?label), "${term}"), 3, 0) +
            IF(CONTAINS(LCASE(?abstract), "${term}"), 1, 0)` : '1'}
        )
        LIMIT 10
    `);
    
    try {
        const response = await fetch(
            `${DBPEDIA_ENDPOINT}?query=${query}&format=json`,
            { headers: { 'Accept': 'application/sparql-results+json' } }
        );
        
        if (!response.ok) throw new Error('Connection error');
        
        const data = await response.json();
        displayResults(data.results.bindings);
    } catch (error) {
        console.error('Error:', error);
        resultsDiv.innerHTML = '<p class="text-red-500 text-center">Search error</p>';
    }
}

// Function to format property value
function formatPropertyValue(value) {
    if (!value) return 'Not available';
    if (value.type === 'uri') {
        return value.value.split('/').pop().replace(/_/g, ' ');
    }
    return value.value;
}

// Function to display results
function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    
    if (!results || results.length === 0) {
        resultsDiv.innerHTML = `
            <div class="glass rounded-xl p-6 text-center">
                <p class="text-gray-400">No black holes found</p>
                <p class="text-sm text-gray-500 mt-2">Try terms like "Sagittarius" or "M87"</p>
            </div>`;
        return;
    }
    
    let html = '';
    results.forEach((result, index) => {
        const label = cleanText(result.label?.value || 'Unnamed');
        const blackholeUri = result.blackhole.value;
        const blackholeId = blackholeUri.split('/').pop();
        
        html += `
            <a href="details.html?name=${encodeURIComponent(blackholeId)}" 
               class="block glass rounded-xl p-6 transform transition-all duration-300 hover:scale-[1.02] cursor-pointer">
                <div class="flex flex-col gap-3">
                    <h2 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                        ${label}
                    </h2>
                    <p class="text-gray-300 leading-relaxed line-clamp-3">
                        ${result.abstract?.value || 'No description available'}
                    </p>
                </div>
            </a>`;
    });
    
    resultsDiv.innerHTML = html;
}

// Remove modal related code and event listeners
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') search();
    });
    
    document.getElementById('constellFilter').addEventListener('change', search);
    document.getElementById('classFilter').addEventListener('change', search);
    
    // Load initial results
    const urlParams = new URLSearchParams(window.location.search);
    const searchTerm = urlParams.get('search');
    if (searchTerm) {
        document.getElementById('searchInput').value = searchTerm;
        search();
    } else {
        loadBlackHoles();
    }
}); 