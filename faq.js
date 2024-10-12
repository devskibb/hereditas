document.addEventListener('DOMContentLoaded', () => {
    // Select all elements with the class 'toggle-header'
    const toggleHeaders = document.querySelectorAll('.toggle-header');
    
    toggleHeaders.forEach(header => {
      // Add a click event listener to each header
      header.addEventListener('click', () => {
        // Toggle the 'active' class on the clicked header
        header.classList.toggle('active');
        
        // Select the next sibling element (the corresponding 'toggle-content' div)
        const content = header.nextElementSibling;
        
        // Check if the content is currently visible
        if (content.style.display === 'block') {
          // If visible, hide it
          content.style.display = 'none';
        } else {
          // If hidden, show it
          content.style.display = 'block';
        }
      });
    });
  });
