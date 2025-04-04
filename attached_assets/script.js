document.addEventListener('DOMContentLoaded', function() {
    const translateButton = document.getElementById('translate-button');
    const inputText = document.getElementById('input-text');
    const outputText = document.getElementById('output-text');

    translateButton.addEventListener('click', async function() {
        const textToTranslate = inputText.value;

        if (textToTranslate.trim() === '') {
            alert('Please enter text to translate.');
            return;
        }

        try {
            const response = await fetch('/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: textToTranslate })
            });

            if (!response.ok) {
                throw new Error('Translation failed');
            }

            const data = await response.json();
            outputText.textContent = data.translated_text;
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while translating. Please try again.');
        }
    });
});