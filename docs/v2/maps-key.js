/* The Google Maps key for the buildings' 3D view. Empty in the repository:
   the deploy (.github/workflows/pages.yml) writes the real one here from the
   repository secret GOOGLE_MAPS_KEY. It is a browser key, restricted in
   Google Cloud to this site's address. */
window.MAPS_KEY = window.MAPS_KEY || "";
