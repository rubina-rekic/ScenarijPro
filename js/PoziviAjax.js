const PoziviAjax = (function() {
    const API_BASE = "/api";

    function handleResponse(promise, callback) {
        promise
            .then(response => {
                response.json().then(data => {
                    callback(response.status, data);
                });
            })
            .catch(err => {
                callback(500, { message: "Greška u komunikaciji sa serverom" });
            });
    }

    return {
        postScenario: function(title, callback) {
            handleResponse(fetch(`${API_BASE}/scenarios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            }), callback);
        },

        lockLine: function(scenarioId, lineId, userId, callback) {
            handleResponse(fetch(`${API_BASE}/scenarios/${scenarioId}/lines/${lineId}/lock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            }), callback);
        },

        updateLine: function(scenarioId, lineId, userId, newText, callback) {
            handleResponse(fetch(`${API_BASE}/scenarios/${scenarioId}/lines/${lineId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, newText })
            }), callback);
        },

        lockCharacter: function(scenarioId, characterName, userId, callback) {
            handleResponse(fetch(`${API_BASE}/scenarios/${scenarioId}/characters/lock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, characterName })
            }), callback);
        },

        updateCharacter: function(scenarioId, userId, oldName, newName, callback) {
            handleResponse(fetch(`${API_BASE}/scenarios/${scenarioId}/characters/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, oldName, newName })
            }), callback);
        },

        getDeltas: function(scenarioId, since, callback) {
            handleResponse(fetch(`${API_BASE}/scenarios/${scenarioId}/deltas?since=${since}`), callback);
        },

        getScenario: function(scenarioId, callback) {
            handleResponse(fetch(`${API_BASE}/scenarios/${scenarioId}`), callback);
        }
    };
})();