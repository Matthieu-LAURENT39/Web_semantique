const DBPEDIA_ENDPOINT = 'https://dbpedia.org/sparql';

// Récupérer les paramètres de l'URL
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Fonction pour fetch les détails d'une mission en particulier 
async function loadMissionDetails() {
    const missionName = getQueryParam("name");
    if (!missionName) {
        showNoDetailsFound();
        return;
    }

    try {
        let query = `
            SELECT DISTINCT ?entity ?label ?abstract 
                SAMPLE(?thumbnail) as ?img
                (GROUP_CONCAT(DISTINCT ?operator; separator=", ") AS ?operators)
                (GROUP_CONCAT(DISTINCT ?crew; separator=", ") AS ?crews)
                ?launchDate ?landingDate
                (GROUP_CONCAT(DISTINCT ?launchSite; separator=", ") AS ?launchSites)
                WHERE {
                    ?entity rdf:type dbo:SpaceMission ;
                            rdfs:label ?label .
                    FILTER(REPLACE(str(?label), "_", " ") = "${missionName}")
                    FILTER(LANG(?label) = 'en')
                    
                    OPTIONAL { ?entity dbo:abstract ?abstract . FILTER(LANG(?abstract) = 'en') }
                    OPTIONAL { ?entity foaf:depiction ?thumbnail }
                    OPTIONAL { ?entity dbo:operator ?operator }
                    OPTIONAL { ?entity dbo:crew ?crew }
                    OPTIONAL { ?entity dbo:launchDate ?launchDate }
                    OPTIONAL { ?entity dbo:landingDate ?landingDate }
                    OPTIONAL { ?entity dbp:launchSite ?launchSite }
                }
                GROUP BY ?entity ?label ?abstract ?launchDate ?landingDate
            `;
        query = encodeURIComponent(query);

        const url = `${DBPEDIA_ENDPOINT}?query=${query}&format=json`;
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json'
            }
        });
        
        if (!response.ok) throw new Error('Network error');
            
        const data = await response.json();
        const result = data.results.bindings[0]; 
       
        if (result) {
            showDetailsMission(result);
        } else {
            showNoDetailsFound();
            console.error("No details found for the mission.");
        }
    } catch (error) {
        console.error("Error loading mission details:", error);
        showNoDetailsFound();
    }
}

// Fonction pour afficher les détails de la mission
function showDetailsMission(result) {
    const label = result.label?.value || 'No name';
    const abstract = result.abstract?.value || 'No description available';
    const img = result.img?.value || 'default-mission.svg';
    const operators = result.operators?.value || 'Unknown';
    const crews = result.crews?.value || 'Unknown';
    const launchDate = result.launchDate?.value || 'Unknown';
    const landingDate = result.landingDate?.value || 'Unknown';
    const launchSites = result.launchSites?.value || 'Unknown';

    document.getElementById("mission-img").src = img;
    document.getElementById("mission-img").alt = label;
    document.getElementById("mission-label").textContent = label;
    document.getElementById("mission-description").textContent = abstract;

    // Mise à jour des opérateurs
    const operatorsElement = document.getElementById("mission-operators");
    if (operators !== 'Unknown') {
        const operatorsList = operators.split(",");
        operatorsElement.innerHTML = ""; // Réinitialiser le contenu
        operatorsList.forEach((operatorUri) => {
            const operatorName = operatorUri.split("/").pop().replace(/_/g, " ");
            const listItem = document.createElement("li");
            listItem.textContent = operatorName;
            operatorsElement.appendChild(listItem);
        });
    } else {
        operatorsElement.textContent = operators;
    }

    // Mise à jour de l'équipage
    const crewsElement = document.getElementById("mission-crews");
    if (crews !== 'Unknown') {
        const crewsList = crews.split(",");
        crewsElement.innerHTML = ""; // Réinitialiser le contenu
        crewsList.forEach((crewUri) => {
            const crewName = crewUri.split("/").pop().replace(/_/g, " ");
            const listItem = document.createElement("li");
            const link = document.createElement("a");
            link.href = `astronaut_detail.html?name=${encodeURIComponent(crewName)}`;
            link.textContent = crewName;
            link.classList.add("text-cyan-400", "hover:underline");
            listItem.appendChild(link);
            crewsElement.appendChild(listItem);
        });
    } else {
        document.getElementById("crews-section").style.display = 'none';
    }

    // Mise à jour des dates
    document.getElementById("mission-launch-date").textContent = formatDate(launchDate);
    document.getElementById("mission-landing-date").textContent = formatDate(landingDate);

    // Mise à jour des sites de lancement
    const launchSitesElement = document.getElementById("mission-launch-sites");
    if (launchSites !== 'Unknown') {
        const sitesList = launchSites.split(",");
        launchSitesElement.innerHTML = ""; // Réinitialiser le contenu
        sitesList.forEach((siteUri) => {
            const siteName = siteUri.split("/").pop().replace(/_/g, " ");
            const listItem = document.createElement("li");
            listItem.textContent = siteName;
            launchSitesElement.appendChild(listItem);
        });
    } else {
        launchSitesElement.textContent = launchSites;
    }
}

function showNoDetailsFound() {
    document.getElementById("mission-label").textContent = "No Information Available";
    document.getElementById("mission-img").src = "default-mission.svg";
    document.getElementById("mission-img").alt = "No Image Available";
    document.getElementById("mission-description").textContent = "No description available";
    document.getElementById("mission-operators").textContent = "Unknown";
    document.getElementById("crews-section").style.display = 'none';
    document.getElementById("mission-launch-date").textContent = "Unknown";
    document.getElementById("mission-landing-date").textContent = "Unknown";
    document.getElementById("mission-launch-sites").textContent = "Unknown";
}

// Fonction pour formater les dates
function formatDate(dateString) {
    if (dateString === 'Unknown') return dateString;
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    } catch (e) {
        return dateString;
    }
}

loadMissionDetails();