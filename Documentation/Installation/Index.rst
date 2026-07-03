..  _installation:

Installation
============

The extension has to be installed like any other TYPO3 CMS extension.
You can download the extension using one of the following methods:

..  tabs::

    ..  group-tab:: composer

        ..  code-block:: bash
            :caption: only the extension itself

            composer require -W \
               'web-vision/a11y-by-default':'~1.0.0@dev'

        ..  note::

            **Be aware** that aforementioned version constraints may be outdated, look up
            actual version by checking the `packagist.org <https://packagist.org/>`_
            meta-data repository.

            * `packagist.org - web-vision/a11y-by-default<https://packagist.org/packages/web-vision/a11y-by-default>`_

    ..  group-tab:: Extension Manager

        #.  Switch to the module :guilabel:`System > Extensions`.
        #.  Switch to :guilabel:`Get Extensions`
        #.  Search for the extension key :guilabel:`a11y_by_default`
        #.  Import the extension from the repository.

        ..  note::

            For TYPO3 v13 navigate :guilabel:`AdminTools > Extensions` to
            find the **Extension Manager**.

    ..  group-tab:: Upload ZIP (TER)

        #.  Get current version from `TER`_ by downloading the zip version.
            Alternatively, get the zip from the `Github Releases`_ page.
        #.  Switch to the module :guilabel:`System > Extensions`.
        #.  Enable upload :guilabel:`Upload Extension`
        #.  Select or drag extension ZIP archive and upload the file

..  attention::

    The extension then needs to be :ref:`configured <configuration>`
    in order to display translation buttons in the desired languages.

..  _TER: https://extensions.typo3.org/extension/a11y_by_default
..  _Github Releases: https://github.com/web-vision/a11y-by-default/releases

Compatibility
-------------

This extension supports:

..  csv-table:: Changes
    :header: "Extension version","TYPO3 Version","PHP version","Supported","Composer","TER"
    :file: Files/versionSupport.csv

.. _installation-next-steps:

Next steps
==========

Once the extension is active, the **Accessibility** module immediately appears
in the **Web** section for administrators. Non-administrator backend users only
see the module once their backend group has been granted access to it, the same
way as for any other TYPO3 backend module. See :ref:`configuration` for the
accessibility-specific settings, in particular the **Developer Corner**
permission.