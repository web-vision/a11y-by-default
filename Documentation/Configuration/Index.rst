.. include:: ../Includes.rst.txt

.. _configuration:

=============
Configuration
=============

This section describes the available configuration options for the Accessibility Checker.

.. _extension-configuration:

Extension Configuration
=======================

Currently, there are no global settings in the **Extension Configuration** (Settings > Extension Configuration). The extension is designed to work out-of-the-box.

.. _user-group-settings:

User and Group Settings
=======================

The extension adds a specific setting to Backend Users and Backend Groups to control the visibility of technical details.

Developer Corner Access
-----------------------

By default, the Accessibility module focuses on editor-relevant issues. To see more technical details (like LANDMARK violations or HTML-level errors), you can enable the **Developer Corner** access for specific users or groups.

1.  Go to **System > Backend Users** (or **Backend Groups**).
2.  Edit the desired user or group.
3.  Navigate to the **Accessibility** tab.
4.  Toggle the **Enable access to Developer Corner** option.

When enabled, the user will see an additional "Developer" tab in the Accessibility module, containing technical issues that usually require template or CSS changes.

.. _engine-selection:

Engine Selection
================

The scanning engine can be selected directly within the Accessibility module.

-   **axe-core** (Default): A powerful, widely used accessibility testing engine.
-   **HTML CodeSniffer**: An alternative engine that provides a different set of checks and recommendations.

You can switch between these engines using the dropdown menu in the module's header. The selection is persistent for your current session.
