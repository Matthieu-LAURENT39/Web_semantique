const DBPEDIA_ENDPOINT = 'https://dbpedia.org/sparql';

// Function to clean text
function cleanText(text) {
    return text.replace(/\(.*?\)/g, '').trim();
}

// Function to format property value
function formatPropertyValue(value) {
    if (!value) return 'Not available';
    if (value.type === 'uri') {
        return value.value.split('/').pop().replace(/_/g, ' ');
    }
    return value.value;
}

// Function to load black hole details
async function loadBlackHoleDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const blackholeName = urlParams.get('name');
    
    if (!blackholeName) {
        showError('No black hole specified');
        return;
    }
    
    const query = encodeURIComponent(`
        PREFIX dbo: <http://dbpedia.org/ontology/>
        PREFIX dbr: <http://dbpedia.org/resource/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX dct: <http://purl.org/dc/terms/>
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        PREFIX dbp: <http://dbpedia.org/property/>
        
        SELECT ?label ?abstract ?class ?constell ?epoch ?rotationalVelocity WHERE {
            dbr:${blackholeName} rdfs:label ?label ;
                                dbo:abstract ?abstract .
            OPTIONAL { dbr:${blackholeName} dbp:class ?class }
            OPTIONAL { dbr:${blackholeName} dbp:constell ?constell }
            OPTIONAL { dbr:${blackholeName} dbp:epoch ?epoch }
            OPTIONAL { dbr:${blackholeName} dbp:rotationalVelocity ?rotationalVelocity }
            
            FILTER(LANG(?label) = 'en')
            FILTER(LANG(?abstract) = 'en')
        }
        LIMIT 1
    `);
    
    try {
        const response = await fetch(
            `${DBPEDIA_ENDPOINT}?query=${query}&format=json`,
            { headers: { 'Accept': 'application/sparql-results+json' } }
        );
        
        if (!response.ok) throw new Error('Connection error');
        
        const data = await response.json();
        if (data.results.bindings.length === 0) {
            showError('Black hole not found');
            return;
        }
        
        displayDetails(data.results.bindings[0]);
    } catch (error) {
        console.error('Error:', error);
        showError('Error loading black hole details');
    }
}

// Function to display error
function showError(message) {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = `
        <div class="glass rounded-xl p-6 text-center">
            <p class="text-red-500">${message}</p>
            <a href="blackholes.html" class="text-cyan-400 hover:text-cyan-300 mt-4 inline-block">
                Return to search
            </a>
        </div>
    `;
}

// Function to display black hole details
function displayDetails(result) {
    const contentDiv = document.getElementById('content');
    const label = cleanText(result.label?.value || 'Unnamed');
    const abstract = result.abstract?.value || 'No description available';
    
    // Format additional properties
    const properties = [
        { label: 'Class', value: formatPropertyValue(result.class) },
        { label: 'Constellation', value: formatPropertyValue(result.constell) },
        { label: 'Epoch', value: formatPropertyValue(result.epoch) },
        { label: 'Rotational Velocity', value: formatPropertyValue(result.rotationalVelocity) }
    ];
    
    document.title = `${label} - Black Hole Details`;
    
    contentDiv.innerHTML = `
        <div class="glass rounded-xl p-6">
            <h1 class="text-4xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                ${label}
            </h1>
            
            <div class="space-y-6">
                <div class="info-card">
                    <p class="text-gray-300 leading-relaxed text-lg">
                        ${abstract}
                    </p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${properties.map(prop => `
                        <div class="info-card">
                            <h3 class="text-cyan-400 font-semibold mb-1">${prop.label}</h3>
                            <p class="text-gray-300">${prop.value}</p>
                        </div>
                    `).join('')}
                </div>
                
                <div class="info-card mt-6">
                    <p class="text-sm text-gray-400">
                        Source: DBpedia
                    </p>
                </div>
            </div>
        </div>
    `;
}

// Load details when page loads
document.addEventListener('DOMContentLoaded', loadBlackHoleDetails); 