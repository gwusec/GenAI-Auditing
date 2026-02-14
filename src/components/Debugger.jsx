import React from "react";

function StorageResetButtons() {
    // Function to clear localStorage
    const handleResetLocalStorage = () => {
        localStorage.clear();
        alert("Local storage has been reset!");
        window.location.reload(); // Force reload to apply changes immediately
    };

    // Function to delete IndexedDB
    const handleResetIndexedDB = () => {
        const dbName = "llmChatDatabase";
        const deleteRequest = indexedDB.deleteDatabase(dbName);

        deleteRequest.onsuccess = () => {
            alert(`IndexedDB "${dbName}" has been deleted!`);
            window.location.reload(); // Force reload
        };

        deleteRequest.onerror = () => {
            alert(`Error deleting IndexedDB "${dbName}".`);
        };

        deleteRequest.onblocked = () => {
            alert(`Deletion of IndexedDB "${dbName}" is blocked. Close other tabs.`);
        };
    };

    return (
        <div style={styles.container}>
            {/* <h2>Debugger Tools (debugMode=true)</h2> */}
            <h3 style={{ marginBottom: '10px' }}>Reset Options</h3>
            <button onClick={handleResetLocalStorage} style={styles.button}>
                Reset Local Storage
            </button>
            <button onClick={handleResetIndexedDB} style={styles.button}>
                Delete IndexedDB
            </button>
        </div>
    );
}

// Optional inline styles for better button appearance
const styles = {
    container: {
        textAlign: "center",
        marginTop: "20px",
        padding: "20px",
        borderTop: "1px solid #ccc"
    },
    button: {
        margin: "10px",
        padding: "10px 20px",
        backgroundColor: "#ff4d4f",
        color: "#fff",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
        fontSize: "16px",
    },
};

export default StorageResetButtons;
