.. include:: /Includes.rst.txt

.. _installation:

============
Installation
============

The extension can be installed using Composer or manually via the Extension Manager.

Requirements
============

*   TYPO3 13.4 or 14.0
*   PHP 8.2 or higher

.. _installation-composer:

Installation via Composer
=========================

The recommended way to install the extension is via Composer:

.. code-block:: bash

   composer require web-vision/a11y-by-default

.. _installation-manual:

Manual Installation
===================

1.  Download the extension as a ZIP file.
2.  Extract the contents into the ``typo3conf/ext/a11y_by_default`` directory of your TYPO3 installation.
3.  Log in to the TYPO3 backend and go to **Admin Tools > Extensions**.
4.  Find the extension and click the **Activate** icon.

.. _installation-next-steps:

Next steps
==========

Once the extension is active, the **Accessibility** module immediately appears
in the **Web** section for administrators. Non-administrator backend users only
see the module once their backend group has been granted access to it, the same
way as for any other TYPO3 backend module. See :ref:`configuration` for the
accessibility-specific settings, in particular the **Developer Corner**
permission.
