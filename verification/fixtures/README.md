# Camera regression fixture

`astronaut.jpg` is a JPEG conversion of scikit-image's 512×512 NASA photograph
of astronaut Eileen Collins. It is test input for face presence only; no
identity comparison or descriptor is computed.

- Source image: https://raw.githubusercontent.com/scikit-image/scikit-image/v0.24.0/skimage/data/astronaut.png
- Source documentation and public-domain statement: https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut
- NASA source linked by scikit-image: https://flic.kr/p/r9qvLn

The scikit-image documentation states that this NASA image has no known
copyright restrictions and was released into the public domain. The fixture
is bundled so regression tests need no third-party image request.
