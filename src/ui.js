/**
 * Small DOM utilities.
 *
 * Keeps repetitive safe text updates out of the main controller.
 */

/**
 * Updates an element's text content when the element exists.
 *
 * @param {string} id Element id.
 * @param {string} value Text to render.
 * @returns {void}
 */
export function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}
